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

    function getValue(v) {
        if (v instanceof Reference) {
            if (!v.base) {
                throw new ReferenceError(v.propertyName + " is not defined",
                                         v.node.filename, v.node.lineno);
            }
            return v.base.Get(v.propertyName);
        }
        return v;
    }

    function putValue(v, w, vn) {
        if (v instanceof Reference)
            return (v.base || globalObject).Put(v.propertyName, w, true);
        throw new ReferenceError("Invalid assignment left-hand side",
                                 vn.filename, vn.lineno);
    }    
    
    
    Narcissus.Object = function () {                  
    };
    
    Narcissus.Object.prototype = {
        
        Prototype: null,
        Class: 'Object',
        Extensible: false,
        
        Get: function () {
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
            if (!this.Properties[P].Value && !this.Properties[P].Get && !this.Properties[P].Set)
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
            
            //console.log('[' + this.Class + '] P: ' + P + ' HasIt: ' + !!current + ' Extensible: ' + extensible);

            if (current === undefined && !extensible)
                return false;

            if (current === undefined && extensible) {
                if (IsGenericDescriptor(Desc) || IsDataDescriptor(Desc)) {
                    this.Properties[P] = {
                        Value: Desc.Value || undefined,
                        Writable: !!Desc.Writable,
                        Enumerable: !!Desc.Enumerable,
                        Configurable: !!Desc.Configurable,
                    };                    
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
        },
                

        /* Extended */
        
        DefineNativeFunction: function (name, length, func) {
            var func;
            
            /* ToDo The real logic */
            
            func = new (Narcissus.ObjectFunctionInstance);
            func.DefineOwnProperty('length', 
                {Value: length, Enumerable: false, Configurable: false, Writable: false});
            func.Native = true;
            func.Call = func;
            
            o = {};
            o.Value = func;
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
        Prototype: Narcissus.ObjectFunctionProtype,
        
        Call: function (thisArg, args) {
            
        }
    });
    
    
    /* Object */
    
    Narcissus.ObjectObjectConstructor = function () {
        this.Properties = {};        
        this.DefineOwnProperty('prototype', 
            {Value: Narcissus.ObjectObjectPrototype, Enumerable: false, Writable: true, Configurable: true});
            
            
        this.DefineNativeFunction('keys', 0, function keys (thisArg, args) {});
        this.DefineNativeFunction('create', 0, function keys (thisArg, args) {});
    };

    extend(Narcissus.ObjectObjectConstructor, Narcissus.Object, {
        Class: 'Function',
        Extensible: true,
        Prototype: Narcissus.ObjectFunctionPrototype,
        
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
            
            console.log('thisArg: ' + thisArg);
                
            class = ToObject(thisArg).Class;
            return '[object ' + class + ']';
        });
    };
    
    extend(Narcissus.ObjectObjectPrototype, Narcissus.Object, {
        Class: 'Object',
        Extensible: true,
        Prototype: null
        
    });   
        

    /* Object Instance */
    
    Narcissus.ObjectObjectInstance = function () {
        this.Properties = {};
    };
    
    
    extend(Narcissus.ObjectObjectInstance, Narcissus.Object, {
        Class: 'Object',
        Extensible: true,
        Prototype: Narcissus.ObjectObjectPrototype
    });
    
    
    
    var globals = {
        'Object': new (Narcissus.ObjectObjectConstructor),
        'Object#prototype': new (Narcissus.ObjectObjectPrototype),
        
        'Function': new (Narcissus.ObjectFunctionConstructor),
        'Function#prototype': new (Narcissus.ObjectFunctionPrototype),
    };
    
    /* Set Up The Global Object */    
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
    
    /* Set Up Object */    
    globalObject.DefineOwnProperty('Object', 
        {Value: globals['Object'], Writable: true, Enumerable: false, Configurable: true});
    
    globals['Object'].Prototype = globals['Function#prototype'];
    globals['Object'].Properties['prototype'].Value = globals['Object#prototype'];        
    globals['Object#prototype'].Prototype = null;
    
    Narcissus.ObjectObjectInstance.Prototype = globals['Object#prototype'];

    /* Set Up Function */    
    globalObject.DefineOwnProperty('Function', 
        {Value: globals['Function'], Writable: true, Enumerable: false, Configurable: true});
     
    globals['Function'].Prototype = globals['Function#prototype'];
    globals['Function'].Properties['prototype'].Value = globals['Functon#prototype'];
    globals['Function#prototype'].Prototype = globals['Object#prototype']
    globals['Function#prototype'].Properties['constructor'].Value = globals['Function'];           
    
    Narcissus.ObjectFunctionInstance.Prototype = globals['Function#prototype'];

    console.log(globalObject);
    
    /* ToDo Function Stubs (Hackzzzz) */
    
    function ToObject (x) {
        return Object(x);
    }
    
    function IsCallable(func) {
        return !!ToObject(x).Call;
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
            var prev = ExecutionContext.current;
            ExecutionContext.current = this;
            try {
                execute(n, this);
            } catch (e if e === THROW) {
                // Propagate the throw to the previous context if it exists.
                if (prev) {
                    prev.result = this.result;
                    throw THROW;
                }
                // Otherwise reflect the throw into host JS.
                throw this.result;
            } finally {
                ExecutionContext.current = prev;
            }
        }
    };    
        
    /* Muhaaa */
    
    
    function execute(node, context) {
        var a, f, i, j, r, s, t, u, v;
        var value;
        
        
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
                
            case SEMICOLON:
                if (node.expression)
                    context.result = getValue(execute(node.expression, context));                
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
            
            default:
                throw 'Not Implemented: ' + node.type + ' ' + Narcissus.definitions.tokens[node.type];
        }
        
        return value;
    }

    
    
    function evaluate(s, f, l) {
        if (typeof s !== "string")
            return s;

        var x = new ExecutionContext(GLOBAL_CODE);        
        x.execute(parser.parse(new parser.DefaultBuilder, s, f, l));
        return x.result;
    }
    
    
    return {
        evaluate: evaluate
    };
    
})();
