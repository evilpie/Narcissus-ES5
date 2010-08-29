Narcissus.interpreter = (function () {

    var extend = function(child, parent, proto) {
        var ctor = function(){};
        ctor.prototype = parent.prototype;
        child.prototype = new ctor();
        child.prototype.constructor = child;
        for (key in proto) {
            child.prototype[key] = proto[key];
        }
    };


    /* Copy -> */

    var parser = Narcissus.parser;
    var definitions = Narcissus.definitions;
    var hostGlobal = Narcissus.hostGlobal;


    eval(definitions.consts);


    /* <- */

    function Reference(base, propertyName, node) {
        this.base = base;
        this.propertyName = propertyName;
        this.node = node;
    }

    Reference.prototype.toString = function () {
        return this.node.getSource();
    }

    function GetValue(v) {
        if (v instanceof Reference) {
            if (!v.base) {
                throw new ReferenceError(v.propertyName + " is not defined", v.node.filename, v.node.lineno);
            }
            
            return v.base.Get(v.propertyName);
        }
        return v;
    }

    function PutValue(v, w, vn) {
        if (v instanceof Reference)
            return (v.base || globalObject).Put(v.propertyName, w, true);
        throw new ReferenceError("Invalid assignment left-hand side", vn.filename, vn.lineno);
    }


    Narcissus.Object = function () {
    };

    Narcissus.Object.prototype = {

        Prototype: null,
        Class: 'Object',
        Extensible: false,

        Get: function (P) {
            var desc, getter;

            desc = this.GetProperty(P);
            if (desc === undefined)
                return undefined;
                

            if (IsDataDescriptor(desc))
                return desc.Value;

            getter = desc.Get;
            if (getter === undefined)
                return undefined;

            return getter.Call(this, []);
        },

        GetOwnProperty: function (P) {
            var D, X;
            
            if (!this.Properties.hasOwnProperty(P))
                return undefined;

            // Hack
            if (!('Value' in this.Properties[P]) && !('Get' in this.Properties[P]) && !('Set' in this.Properties[P]))
                return undefined;

            D = {};
            X = this.Properties[P];

            if (IsDataDescriptor(X)) {
                D.Value = X.Value;
                D.Writable = X.Writable;
            }
            else {
                D.Get = X.Get;
                D.Set = X.Set;
            }

            D.Enumerable = X.Enumerable;
            D.Configurable = X.Configurable;
            
            return D;
        },

        GetProperty: function (P) {
            var prop, proto;

            prop = this.GetOwnProperty(P);
            
            if (prop)
                return prop;

            proto = this.Prototype;
            if (proto === null)
                return undefined;

            return proto.GetProperty(P);
        },

        Put: function (P, V, Throw) {
            var desc, ownDesc, valueDesc;

            if (!this.CanPut(P)) {
                if (Throw)
                    throw TypeError;

                return;
            }

            ownDesc = this.GetOwnProperty(P);

            if (IsDataDescriptor(ownDesc)) {
                valueDesc = {Value: V};
                this.DefineOwnProperty(P, valueDesc, Throw);
                return;
            }

            desc = this.GetProperty(P);
            if (IsAccessorDescriptor(desc)) {
                desc.Set.Call(this, [V]);
            }

            desc = {Value: V, Writable: true, Enumerable: true, Configurable: true};
            this.DefineOwnProperty(P, desc, Throw);
        },

        CanPut: function (P) {
            var desc, proto, inherited;

            desc = this.GetOwnProperty(P);

            if (desc !== undefined) {
                if (IsAccessorDescriptor(desc))
                    return (desc.Set !== undefined);
                else
                    return desc.Writable
            }

            proto = this.Prototype;
            if (proto === null)
                return this.Extensible;

            inherited = proto.GetProperty(P);
            if (inherited === undefined)
                return this.Extensible;

            if (IsAccessorDescriptor(inherited))
                return (inherited.Set !== undefined);
            else {
                if (this.Extensible == false)
                    return false
                return inherited.Writable;
            }

        },

        HasProperty: function (P) {
            return (this.GetProperty(P) !== undefined);
        },

        Delete: function (P, Throw) {
            var desc;

            desc = this.GetOwnProperty(P);
            if (desc === undefined)
                return true;

            if (desc.Configurable) {
                delete this.Properties[P];
                return true;
            }
            if (Throw)
                throw TypeError;

            return false;
        },

        DefaultValue: function () {
        },

        DefineOwnProperty: function (P, Desc, Throw) {
            var current, extensible;

            current = this.GetOwnProperty(P);
            extensible = this.Extensible;

            if (current === undefined && !extensible)
                return false;

            if (current === undefined && extensible) {
                if (IsGenericDescriptor(Desc) || IsDataDescriptor(Desc)) {
                    this.Properties[P] = {
                        Value: Desc.Value,
                        Writable: !!Desc.Writable,
                        Enumerable: !!Desc.Enumerable,
                        Configurable: !!Desc.Configurable,
                    };
                    
                    if (!Desc.hasOwnProperty('Value')) {
                        this.Properties[P].Value = undefined;
                    }
                }
                else {
                    this.Properties[P] = {
                        Get: Desc.Set || undefined,
                        Set: Desc.Get || undefined,
                        Writable: !!Desc.Writable,
                        Enumerable: !!Desc.Enumerable,
                        Configurable: !!Desc.Configurable,
                    };
                }

                return true;
            }

            if (!('Value' in Desc) && !('Get' in Desc) && !('Set' in Desc) &&
                !('Writable' in Desc) && !('Enumerable' in Desc) && !('Writable' in Desc)) {
                return true;
            }

            /* ToDo */
            
            throw 'ToDo DefineOwnProperty';
            
        },


        /* Extended */

        DefineNativeFunction: function (name, length, func) {
            var funcObject;

            /* ToDo The real logic */

            funcObject = new (Narcissus.ObjectFunctionInstance);
            funcObject.DefineOwnProperty('length',
                {Value: length, Enumerable: false, Configurable: false, Writable: false});
            funcObject.Native = true;
            funcObject.Call = func;

            o = {};
            o.Value = funcObject;
            o.Writable = true;
            o.Enumerable = false;
            o.Configurable = true;

            this.Properties[name] = o;
        }

    };


    /* Funtion */

    Narcissus.ObjectFunctionConstructor = function () {
        this.Properties = {};
        this.DefineOwnProperty('length',
            {Value: 1, Enumerable: false, Writable: false, Configurable: false});
        this.DefineOwnProperty('prototype',
            {Value: Narcissus.ObjectFunctionPrototype, Enumerable: false, Writable: false, Configurable: false});

        this.DefineNativeFunction('toString', 0, function (thisArg, args) {});
        this.DefineNativeFunction('call', 1, function (thisArg, args) {
            var func, funcThis, funcArgs;

            func = thisArg;
            funcThis = args[0];
            funcArgs = args.slice(1);

            if (!IsCallable(func))
                throw TypeError

            return func.Call(funcThis, funcArgs);
        });

    };

    extend(Narcissus.ObjectFunctionConstructor, Narcissus.Object, {
        Class: 'Function',
        Extensible: true,
        Prototype: Narcissus.ObjectFunctionPrototype,

        Call: function (thisArg, args) {
            if (args.length == 0 || args[0] === null || args[0] === undefined) {
                return this.Construct(thisArg, []);
            }
            return ToObject(args[0]);
        },

        Construct: function (thisArg, args) {

        }
    });


    /* Function.prototype */

    Narcissus.ObjectFunctionPrototype = function () {
        this.Properties = {};
        this.DefineOwnProperty('length',
            {Value: 0, Enumerable: false, Writable: true, Configurable: true});
        this.DefineOwnProperty('constructor',
            {Value: Narcissus.ObjectFunctionConstructor, Enumerable: false, Writable: true, Configurable: true});
    };

    extend(Narcissus.ObjectFunctionPrototype, Narcissus.Object, {
        Class: 'Function',
        Extensible: true,
        Prototype: Narcissus.ObjectObjectPrototype
    });



    /* Function Instance */

    Narcissus.ObjectFunctionInstance = function () {
        this.Properties = {};
    };


    extend(Narcissus.ObjectFunctionInstance, Narcissus.Object, {
        Class: 'Function',
        Extensible: true,
        
        Scope: undefined,
        ThisObject: null,
        COde: undefined,
        FormalParamaters: [],
        Strict: false,

        Call: function (thisArg, args, context) {
            var functionContext, argsObject, scopeObject;
            
            functionContext = new ExecutionContext(FUNCTION_CODE);
            
            if (this.Strict) {
                functionContext.thisObject = thisArg || null;
            }
            else {            
                functionContext.thisObject = thisArg || globalObject;
            }
            
            /* old code */
            functionContext.caller = context;
            functionContext.callee = this;
            
            /* ToDo Some kind of scope object */
            scopeObject = new (Narcissus.ObjectObjectInstance);
            scopeObject.Prototype = null;
            scopeObject.Class = 'Scope';
            
            
            /* ToDo  Arguments Object - This is !not! the real logic*/
            argsObject = new (Narcissus.ObjectObjectInstance);
            argsObject.Prototype = null; /* Fixme */
            argsObject.Class = 'Arguments';
                        
            
            for (var i = 0; i < args.length; i++) {
                argsObject.DefineOwnProperty(ToString(i), 
                    {Value: args[i], Configurable: false, Writable: false, Enumerable: false});
                
                /* Define Formal Parameters */
                if (this.FormalParameters[i]) {
                    scopeObject.DefineOwnProperty(this.FormalParameters[i],
                        {Value: args[i], Configurable: false, Writable: true, Enumerable: false});                    
                }
            }
            
            argsObject.DefineOwnProperty('length', 
                    {Value: args[i], Configurable: false, Writable: false, Enumerable: false});
                    
            argsObject.DefineOwnProperty('callee', 
                    {Value: this, Configurable: false, Writable: false, Enumerable: false});
            
            argsObject.Extensible = false;
            
            
            scopeObject.DefineOwnProperty('arguments', 
                {Value: this, Configurable: false, Writable: false, Enumerable: false});
                
            functionContext.scope = {scope: scopeObject, parent: this.Scope};
            
            /* Let the party start */
            
            try {
                functionContext.execute(this.Code)
            }
            catch (e) {
                if (e === RETURN) {
                    return functionContext.result;
                }
                else {
                    throw e;
                }
            }
            
            return undefined;
        },
        
        Construct: function (thisArg, args, context) {
        }
    });
    
    function createFunction (node, context) {
        var func, proto;
        
        func = new (Narcissus.ObjectFunctionInstance);
        func.Scope = context.scope;
        func.Code = node.body;
        
        func.FormalParameters = node.params;
        
        func.DefineOwnProperty('length', 
            {Value: node.params.length, Enumerable: false, Writable: true, Configurable: true});
            
        
        proto = new (Narcissus.ObjectObjectInstance);
        proto.DefineOwnProperty('constructor', 
            {Value: func, Enumerable: false, Writable: true, Configurable: true});
            
        func.DefineOwnProperty('prototype', 
            {Value: proto, Enumerable: false, Writable: true, Configurable: false});            
        
        
        /*
        if (func.Strict) {
        }
        */
        
        return func;
    }


    /* Object */

    Narcissus.ObjectObjectConstructor = function () {
        this.Properties = {};
        
        this.DefineOwnProperty('prototype', 
            {Value: Narcissus.ObjectObjectPrototype, Enumerable: false, Writable: false, Configurable: false});

        this.DefineNativeFunction('keys', 0, function keys (thisArg, args) {});
        this.DefineNativeFunction('create', 0, function keys (thisArg, args) {});
    };

    extend(Narcissus.ObjectObjectConstructor, Narcissus.Object, {
        Class: 'Function',
        Extensible: true,

        Call: function (thisArg, args) {
            return this.Construct(thisArg, args);
        },

        Construct: function (thisArg, args) {
        }

    });


    /* Object.prototype */

    Narcissus.ObjectObjectPrototype = function () {
        this.Properties = {};

        this.DefineNativeFunction('toString', 0, function toString (thisArg, args) {
            var class;

            if (thisArg === null)
                return '[object Null]';
            if (thisArg === undefined)
                return '[object Undefined]';

            class = ToObject(thisArg).Class;
            return '[object ' + class + ']';
        });
    };

    extend(Narcissus.ObjectObjectPrototype, Narcissus.Object, {
        Class: 'Object',
        Extensible: true
    });


    /* Object Instance */

    Narcissus.ObjectObjectInstance = function () {
        this.Properties = {};
    };


    extend(Narcissus.ObjectObjectInstance, Narcissus.Object, {
        Class: 'Object',
        Extensible: true
    });

    /* Array */
    
    
    Narcissus.ObjectArrayConstructor = function () {
        this.Properties = {};

        this.DefineOwnProperty('prototype', 
            {Value: Narcissus.ObjectArrayPrototype, Enumerable: false, Writable: false, Configurable: false});
        
        this.DefineOwnProperty('length',
            {Value: 1, Enumerable: false, Writable: true, Configurable: true});                             
    }
    
    extend(Narcissus.ObjectArrayConstructor, Narcissus.Object, {
        Class: 'Function',
        Extensible: true,
        
        Call: function (thiArg, args) {
        },
        
        Construct: function (thiArg, args) {
        }
        
    });
    
    /* Array.prototype */
    
    Narcissus.ObjectArrayPrototype = function () {
        this.Properties = {};
    }
    
    extend(Narcissus.ObjectArrayPrototype, Narcissus.Object, {
        Class: 'Array',
        Extensible: true,
    });
    
    
    /* Array Instance */
    
    Narcissus.ObjectArrayInstance = function () {
        this.Properties = {};
        
        /* Hack this.Properties['length'] */
    };

    extend(Narcissus.ObjectArrayInstance, Narcissus.Object, {
        Class: 'Array',
        Extensible: true,
        
        DefineOwnProperty: function (P, Desc, Throw) {
            
            throw 'ToDo Array#DefineOwnProperty'
            
        }
    });    
    
    
    /* String */
    
    Narcissus.ObjectStringConstructor = function () {
        this.Properties = {};
        
        this.DefineOwnProperty('length',
            {Value: 1, Enumerable: false, Writable: true, Configurable: true});     
    }
    
    extend(Narcissus.ObjectStringConstructor, Narcissus.Object, {
        Class: 'Function',
        Extensible: true,
        
        Call: function (thisArg, args) {
        },
        
        Construct: function (thisArg, args) {
        }
        
    });

    var globals = {
        'Object': new (Narcissus.ObjectObjectConstructor),
        'Object#prototype': new (Narcissus.ObjectObjectPrototype),

        'Function': new (Narcissus.ObjectFunctionConstructor),
        'Function#prototype': new (Narcissus.ObjectFunctionPrototype),
        
        'Array': new (Narcissus.ObjectArrayConstructor),
        'Array#prototype': new (Narcissus.ObjectArrayPrototype),
    };



    /* ==== Set Up The Global Object === */
    
    // All this should be done inside the constructor, but its easier to handle this way
    
    var globalObject = new (Narcissus.ObjectObjectInstance);

    globalObject.Extensible = true;
    globalObject.Call = undefined;
    globalObject.Construct = undefined;
    globalObject.Class = 'Global';
    globalObject.Prototype = null;


    globalObject.DefineOwnProperty('NaN',
        {Value: NaN, Writable: false, Enumerable: false, Configurable: false});

    globalObject.DefineOwnProperty('Infinity',
        {Value: Infinity, Writable: false, Enumerable: false, Configurable: false});

    globalObject.DefineOwnProperty('undefined',    
        {Value: undefined, Writable: false, Enumerable: false, Configurable: false});   

    /* ==== Set Up Object ==== */
    globalObject.DefineOwnProperty('Object',
        {Value: globals['Object'], Writable: true, Enumerable: false, Configurable: true});
    
    globals['Object'].Prototype = globals['Function#prototype'];
    globals['Object'].Properties['prototype'].Value = globals['Object#prototype'];
    globals['Object#prototype'].Prototype = null;

    Narcissus.ObjectObjectInstance.prototype.Prototype = globals['Object#prototype'];

    /*  ==== Set Up Function  ==== */
    globalObject.DefineOwnProperty('Function',
        {Value: globals['Function'], Writable: true, Enumerable: false, Configurable: true});

    globals['Function'].Prototype = globals['Function#prototype'];
    globals['Function'].Properties['prototype'].Value = globals['Functon#prototype'];
    globals['Function#prototype'].Prototype = globals['Object#prototype']
    globals['Function#prototype'].Properties['constructor'].Value = globals['Function'];

    Narcissus.ObjectFunctionInstance.prototype.Prototype = globals['Function#prototype'];

    /*  ==== Set Up Array ==== */
    globalObject.DefineOwnProperty('Array',
        {Value: globals['Array'], Writable: true, Enumerable: false, Configurable: true});
        
    globals['Array'].Prototype = globals['Function#prototype'];
    globals['Array'].Properties['prototype'].Value = globals['Array#prototype'];
    globals['Array#prototype'].Prototype = globals['Object#prototype'];
    globals['Array#prototype'].Properties['constructor'].Value = globals['Array'];
    
    
    Narcissus.ObjectArrayInstance.prototype.Prototype = globals['Array#prototype'];
    
    /*  ==== Set Up String ==== */
    
    
    
    /* Tests */

    /* ToDo Function Stubs (Hackzzzz) */

    function ToPrimitive (Input, PreferredType) {
        var type;
        
        if (Input === null || Input === undefined)
            return x;
        type = typeof Input;
        
        if (type == 'string' || type == 'number' || type == 'boolean')
            return Input;
            
        if (type == 'function')
            throw 'Did not except function type in ToPrimitive'
            
        
        return Input.DefaultValue(PreferredType);
    }
    
    function ToBoolean (Input) {
        var type;
        
        if (Input === null || Input === undefined)
            return false;
            
        type = typeof Input;
        
        if (type == 'boolean')
            return Input;
        
        if (type == 'number')
            return Boolean(Input);
        
        if (type == 'string')
            return (Input.length > 0);
            
        if (type == 'function')
            throw 'Did not except function type in ToBoolean'        
        
        /* must be object */    
        return true;
    }
    
    function ToNumber (Input) {
        var type;
        
        type = typeof Input;
        
        if (type == 'function')
            throw 'Did not except function type in ToNumber'        
            
        if (type == 'object' && Input !== null)
            return ToNumber(ToPrimitve(Input, 'Number'));            
            
        return Number(Input);
    }

    function ToObject (Input) {
        var type, object;
        
        if (Input === null || Input === undefined)
            throw TypeError;
            
        type = typeof Input;
        
        if (type == 'boolean') {
            object = new (Narcissus.ObjectBooleanInstance);
            object.PrimitiveValue = Input;
            return object;
        }
        if (type == 'string') {
            object = new (Narcissus.ObjectStringInstance);
            object.PrimitiveValue = Input;
            return object;            
        }
        if (type == 'number') {
            object = new (Narcissus.ObjectNumberInstance);
            object.PrimitiveValue = Input;
            return object;            
        }
        
        if (type == 'function')
            throw 'Did not except function type in ToObject'           
        
        /* must be object */
        return Input;
    }

    function IsCallable(func) {
        var type = typeof func;
        
        if (type != 'object')
            return false;
            
        return func.Call !== undefined;
    }
    
    function ToString (x) {
        console.error('Fixme ToString');
        
        return String(x);
    }
    
    function IsPrimitive (v) {
        var t = typeof v;
        return (t === "object") ? v === null : t !== "function";
    }

    /* Helper */

    function IsGenericDescriptor (Desc) {
        if (Desc === undefined)
            return false;
        return (!IsAccessorDescriptor(Desc) && !IsDataDescriptor(Desc));
    }

    function IsAccessorDescriptor (Desc) {
        if (Desc === undefined)
            return false;

        if (!Desc.hasOwnProperty('Get') && !Desc.hasOwnProperty('Set'))
            return false

        return true;
    }

    function IsDataDescriptor (Desc) {
        if (Desc === undefined)
            return false;

        if (!Desc.hasOwnProperty('Value') && !Desc.hasOwnProperty('Writable'))
            return false;

        return true;
    }


    /*  Execution Context */

    var GLOBAL_CODE = 0, EVAL_CODE = 1, FUNCTION_CODE = 2;

    function ExecutionContext(type) {
        this.type = type;
    }

    ExecutionContext.current = null;

    ExecutionContext.prototype = {
        caller: null,
        callee: null,
        scope: {object: globalObject, parent: null},
        thisObject: globalObject,
        result: undefined,
        target: null,

        execute: function(n) {
            var previousContext = ExecutionContext.current;
            ExecutionContext.current = this;
            try {
                execute(n, this);
            } 
            catch (e) {                
                if (e === THROW) {                    
                    if (prev) {
                        prev.result = this.result;
                        throw THROW;
                    }                    
                    throw this.result;
                }
                else {
                    throw e;
                }
            } 
            finally {
                ExecutionContext.current = previousContext;
            }
        }
    };

    /* Muhaaa */


    function execute(node, context) {
        var a, f, i, j, r, s, t, u, v;
        var value, args;


        console.log(Narcissus.definitions.tokens[node.type]);

        switch (node.type) {

            case SCRIPT:
                t = context.scope.object;

                /* Assign Declared Functions to the global object */
                a = node.funDecls;
                for (i = 0, j = a.length; i < j; i++) {
                    /* */
                    throw 'Todo Declare Functions'
                }

                /* The same for normal variables */
                a = node.varDecls;
                for (i = 0, j = a.length; i < j; i++) {
                    throw 'Todo Declare Vars'
                }

                /* Fallthrough */
            case BLOCK:
                for (i = 0, j = node.length; i < j; i++) { /* Start executing every node */
                    execute(node[i], context);
                }

                break;
            
            case LIST:
                value = [];
                for (i = 0, j = node.length; i < j; i++) {
                    value.push(GetValue(execute(node[i], context)));
                }
                break;
                
            case CALL:
                r = execute(node[0], context);
                args = execute(node[1], context);
                
                f = ToObject(GetValue(r)); /* Fixme Todo*/
                if (f.Call === undefined) {
                    throw TypeError('Not an function');
                }
                
                thisArg = (r instanceof Reference) ? r.base : null;
                value = f.Call(thisArg, args, context);
                break;

            case SEMICOLON:
                if (node.expression)
                    context.result = GetValue(execute(node.expression, context));
                break;
            
            case ASSIGN:
                r = execute(node[0], context);                
                value = GetValue(execute(node[1], context));
                
                if (node.assignOp) {                    
                    throw 'ToDo ASSING';
                }
                
                PutValue(r, value, node[0]);
                break;
            
            case DOT:
                r = execute(node[0], context);
                t = GetValue(r);
                u = node[1].value;
                
                value = new Reference(ToObject(t), u, node);
                break;
            
            case INDEX:
                r = execute(node[0], context);
                t = GetValue(r);
                u = node[1].value;
                
                value = new Reference(ToObject(t), ToString(u), node);
                break;                
                
            
            case UNARY_PLUS:
            

                
            /* case ARRAY_INIT: */

            case OBJECT_INIT:
                value = new (Narcissus.ObjectObjectInstance);
                
                for (i = 0, j = node.length; i < j; i++) {                    
                    t = node[i];
                    
                    if (t.type === PROPERTY_INIT) {
                        value.DefineOwnProperty(t[0].value, {
                            Enumerable: true, 
                            Configurable: true, 
                            Writable: true, 
                            Value: GetValue(execute(t[1], context))
                        });
                    }
                    else { /* Getter / Setter */
                        throw 'ToDo';
                    }
                }
                break;

            case TRUE:
                value = true;
                break;

            case FALSE:
                value = false;
                break

            case NULL:
                value = null;
                break;

            case THIS:
                value = context.thisObject;
                break;                
                
            case NUMBER:
            case STRING:
            case REGEXP:
                value = node.value;
                break;

            case IDENTIFIER:
                for (s = context.scope; s; s = s.parent) {
                    if (s.object.HasProperty(node.value)) {
                        break;
                    }
                }

                value = new Reference(s && s.object, node.value, node);
                break;

            default:
                throw 'Not Implemented: ' + node.type + ' ' + Narcissus.definitions.tokens[node.type];
        }

        return value;
    }



    function evaluate(code, f, l) {
        var x = new ExecutionContext(GLOBAL_CODE);
        x.execute(parser.parse(new parser.DefaultBuilder, code, f, l));
        return x.result;
    }


    return {
        evaluate: evaluate
    };

})();
