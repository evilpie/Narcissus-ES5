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


    var parser = Narcissus.parser;
    var definitions = Narcissus.definitions;
    var hostGlobal = Narcissus.hostGlobal;


    eval(definitions.consts);


    function Reference(base, propertyName, node, strict) {
        this.base = base;
        this.propertyName = propertyName;
        this.node = node;
        this.strict = strict;
    }

    Reference.prototype = {
        toString: function () {
            return this.node.getSource();
        },
        
        getBase: function () {
            return this.base;
        },
        
        getReferencedName: function () {
            return this.propertyName;            
        },
        
        isStrictReference: function () {
            return this.strict;
        },
        
        hasPrimitiveBase: function () {
            return IsPrimitive(this.base);
        },
        
        isPropertyReference: function () {
            return this.hasPrimitiveBase() || this.base instanceof Narcissus.Object;
        },
        
        isUnresolvableReference: function () {
            return this.base === undefined;
        }
    }
    
    
    function DeclarativeEnvironment () {
        this.bindings = {};
        this.bindingsList = [];
    }
    
    DeclarativeEnvironment.prototype = {
        hasBinding: function (N) {
            return this.bindingsList.indexOf (N) > -1;
        },
        
        createMutableBinding: function (N, D) {
            if (this.bindingsList.indexOf (N) > -1)
                throw '[createMutableBinding] Binding already exists' + N;
                
            this.bindings[N] = {
                value: undefined,
                deletable: D,
                mutable: true,
                initialized: false
            };
            
            this.bindingsList.push(N);
        },
        
        setMutableBinding: function (N, V, S) {
            if (this.bindingsList.indexOf (N) == -1)
                throw '[setMutableBinding] binding does not exists' + N;
                
            if (this.bindings[N].mutable) {
                this.bindings[N].value = V;
                this.bindings[N].initialized = true;
            }
            else {
                throw TypeError('Cannot change immutable binding');
            }
        },
        
        getBindingValue: function (N, Strict) {
            var binding;
            
            if (this.bindingsList.indexOf (N) == -1)
                throw '[getBindingValue] binding does not exists' + N;
                
            binding = this.bindings[N];
            
            if (!binding.mutable && !binding.initialized) {
                if (!Strict) {
                    return false;
                }
                throw ReferenceError('not defined variable');
            }
            
            return binding.value;
        },
        
        deleteBinding: function (N) {
            if (this.bindingsList.indexOf (N) == -1)
                return true;
            
            if (!this.bindings[N].deletable)
                return false;
            
            delete this.bindingList[(this.bindingsList.indexOf (N))];
            delete this.bindings[N];
                
            return true;
        },
        
        implicitThisValue: function () {
            return undefined;
        },
        
        createImmutableBinding: function (N) {
            if (this.bindingsList.indexOf (N) > -1)
                throw '[createImmutableBinding] Binding already exists' + N;
                
            this.bindingList.push(N);
            this.bindings[N] = {
                value: undefined,
                deletable: false,
                mutable: false,
                initialized: false
            };
        },
        
        initializeImmutableBinding: function (N, V) {
            if (this.bindingsList.indexOf (N) == -1)
                throw 'Binding doesnt exists';
            
            if (this.bindings[N].mutable || this.bindings[N].initialized)
                throw 'Binding must be immutable and not initialized';
                
            this.bindings[N].value = V;
            this.bindings[N].initialized = true;
        }
    };
    
    function ObjectEnvironment (Object) {        
        this.object = Object;
        this.provideThis = false;
    }
    
    ObjectEnvironment.prototype = {
        hasBinding: function (N) {
            return this.object.HasProperty(N);
        },
        
        createMutableBinding: function (N, D) {
            if (this.object.HasProperty(N))
                throw 'binding already exists';
            
            this.object.DefineOwnProperty(N, {
                Value: undefined,
                Writable: true,
                Enumerable: true, 
                Configurable: D
            });
        },
        
        setMutableBinding: function (N, V, S) {
            this.object.Put(N, V, S);
        },
        
        getBindingValue: function (N, S) {
            if (!this.object.HasProperty(N)) {
                if (S)
                    throw ReferenceError('variable is undefined')
                
                return undefined;
            }
            
            return this.object.Get(N);
        },
        
        deleteBinding: function (N) {
            return this.object.Delete(N, false);
        },
        
        implicitThisValue: function () {
            if (this.provideThis)
                return this.object;
                
            return undefined;    
        }
    }
    
    function LexicalEnvironment () {
    }    
    
    function newDeclarativeEnvironment (parentEnvironment) {
        var env;
        env = new LexicalEnvironment();
        env.envRec = new DeclarativeEnvironment();
        env.parent = parentEnvironment;
        
        return env;
    }
    
    function newObjectEnvironment (Object, parentEnvironment) {
        var env;
        env = new LexicalEnvironment();
        env.envRec = new ObjectEnvironment(Object);
        env.parent = parentEnvironment;
        
        return env;
    }
    
    
    function GetIdentifierReference (lex, name, strict) {
        if (lex === null) {
            return new Reference(undefined, name, null, strict);        
        }
        
        if (lex.envRec.hasBinding(name)) {
            return new Reference(lex.envRec, name, null, strict);
        }
        else {
            return GetIdentifierReference(lex.parent, name, strict);
        }
    }

    function GetValue(v) {
        if (v instanceof Reference) {
            if (v.isUnresolvableReference()) {
                throw ReferenceError(v.propertyName + ' is not defined');
            }
            
            if (v.isPropertyReference()) {
                if (v.hasPrimitiveBase()) {
                    return (ToObject(v.base)).Get(v.propertyName); 
                    /* do i miss something or is the spec really over complicated */
                }
                else {
                    return v.base.Get(v.propertyName);
                }
            }
            else {
                return v.base.getBindingValue(v.propertyName, v.isStrictReference());
            }
        }
        
        return v;
    }

    function PutValue(v, W) {
        
        if (!(v instanceof Reference)) {
            throw ReferenceError('Invalid assignment left-hand side');
        }
        
        if (v.isUnresolvableReference()) {
            if (v.isStrictReference()) {
                throw ReferenceError('cannot assign to an undefined variable in strict mode');
            }
            globalObject.Put(v.getReferencedName(), W, false);
        }
        else if (v.isPropertyReference()) {
            if (!v.hasPrimitiveBase()) {
                v.base.Put(v.getReferencedName(), W, v.isStrictReference());
            }
            else {
                throw 'ToDo';
            }
        }
        else {
            v.base.setMutableBinding(v.getReferencedName(), W, v.isStrictReference());
        }
        
        return;
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
                throw TypeError('cannot delete an not configurable property');

            return false;
        },

        DefaultValue: function (hint) {
            var toString, valueOf, str, val;

            if (hint === 'String') {
                toString = this.Get('toString');

                if (IsCallable(toString)) {
                    str = toString.Call(this);

                    if (IsPrimitive(str))
                        return str;
                }

                valueOf = this.Get('valueOf');

                if (IsCallable(valueOf)) {
                    val = valueOf.Call(this);

                    if (IsPrimitive(val))
                        return val;
                }
            }
            else {
                valueOf = this.Get('valueOf');

                if (IsCallable(valueOf)) {
                    val = valueOf.Call(this);

                    if (IsPrimitive(val))
                        return val;
                }

                toString = this.Get('toString');

                if (IsCallable(toString)) {
                    str = toString.Call(this);

                    if (IsPrimitive(str))
                        return str;

                }
            }

            throw TypeError('Object could not be converted to ' + hint);
        },

        DefineOwnProperty: function (P, Desc, Throw) {
            var current, extensible, check;

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

            /* 8.12.9 Step 6 */

            check = false;

            for (key in Desc) {
                if (Desc.hasOwnProperty(key) && current[key] === Desc[key])  /* ToDo SameValue */
                    check = true;
                else {
                    check = false;
                    break;
                }
            }

            if (check)
                return true;

            if (current.Configurable === false) {
                if (Desc.Configurable === true)
                    return false;

                if (Desc.hasOwnProperty('Enumerable') && Desc.Enumerable !== current.Enumerable) /* fixme, not sure */
                    return false;
            }

            if (IsGenericDescriptor(Desc)) {
                /* Step 8. No further verification */
            }
            else if (IsDataDescriptor(current) !== IsDataDescriptor(Desc)) {

                if (current.Configurable === false)
                    return false;

                if (IsDataDescriptor(current)) {
                    delete this.Properties[P]['Value'];
                    delete this.Properties[P]['Writable'];
                }
                else {
                    delete this.Properties[P]['Set'];
                    delete this.Properties[P]['Get'];
                }
            }
            else if (IsDataDescriptor(current) === IsDataDescriptor(Desc)) {
                if (current.Configurable === false) {
                    if (current.Writable === false && Desc.Writable === true)
                        return false; /* reject */

                    if (current.Writable === false) {
                        if (Desc.hasOwnProperty('Value') && !SameValue(current.Value, Desc.Value))
                            return false; /* reject */
                    }
                }
            }
            else if (IsAccessorDescriptor(current) === IsAccessorDescriptor(Desc)) {
                if (current.Configurable === false) {
                    if (Desc.hasOwnProperty('Set') && !SameValue(current.Set, Desc.Set))
                        return false;

                    if (Desc.hasOwnProperty('Get') && !SameValue(current.Get, Desc.Get))
                        return false;
                }
            }

            if (Desc.hasOwnProperty('Set'))
                this.Properties[P].Set = Desc.Set || undefined;
            if (Desc.hasOwnProperty('Get'))
                this.Properties[P].Get = Desc.Get || undefined;
            if (Desc.hasOwnProperty('Value'))
                this.Properties[P].Value = Desc.Value || undefined;
            if (Desc.hasOwnProperty('Writable'))
                this.Properties[P].Writable = !!Desc.Writable
            if (Desc.hasOwnProperty('Enumerable'))
                this.Properties[P].Enumerable = !!Desc.Enumerable;
            if (Desc.hasOwnProperty('Configurable'))
                this.Properties[P].Configurable = !!Desc.Configurable;

            return true;
        },


        /* Extended */

        DefineNativeFunction: function (name, length, func) {
            var funcObject, proto;

            funcObject = new (Narcissus.ObjectFunctionInstance);
            funcObject.DefineOwnProperty('length',
                {Value: length, Enumerable: false, Configurable: false, Writable: false});
            funcObject.DefineOwnProperty('name',
                {Value: name, Enumerable: false, Configurable: false, Writable: false});
            funcObject.Native = true;
            funcObject.Call = func;

            proto = new (Narcissus.ObjectObjectInstance);
            proto.DefineOwnProperty('constructor',
                {Value: funcObject, Enumerable: false, Writable: true, Configurable: true});

            funcObject.DefineOwnProperty('prototype',
                {Value: proto, Enumerable: false, Writable: true, Configurable: false});

            o = {};
            o.Value = funcObject;
            o.Writable = true;
            o.Enumerable = false;
            o.Configurable = true;

            this.Properties[name] = o;
        },


        /* hack! this should be in Function.prototype, but because of inheritance ... */
        HasInstance: function (V) {
            var O;

            if (this.Class !== 'Function')
                throw TypeError('operand of instanceof must be an function');

            if (typeof V != 'object')
                return false;

            O = this.Get('prototype');
            if (typeof O != 'object')
                throw TypeError('prototype must be an object');

            for (V = V.Prototype; ; V = V.Prototype) {
                if (V === null)
                    return false;
                if (O === V)
                    return true;
            }
        }

    };


    /* Funtion */

    Narcissus.ObjectFunctionConstructor = function () {
        this.Properties = {};

        this.DefineOwnProperty('prototype',
            {Value: null, Enumerable: false, Writable: false, Configurable: false});

        this.DefineOwnProperty('length',
            {Value: 1, Enumerable: false, Writable: false, Configurable: false});

        this.DefineOwnProperty('prototype',
            {Value: Narcissus.ObjectFunctionPrototype, Enumerable: false, Writable: false, Configurable: false});
    };

    extend(Narcissus.ObjectFunctionConstructor, Narcissus.Object, {
        Class: 'Function',
        Extensible: true,
        Prototype: Narcissus.ObjectFunctionPrototype,

        Call: function (thisArg, args) {
            return this.Construct(thisArg, args);
        },

        Construct: function (thisArg, args) {
            throw 'ToDo';
        }
    });


    /* Function.prototype */

    Narcissus.ObjectFunctionPrototype = function () {
        this.Properties = {};
        this.DefineOwnProperty('length',
            {Value: 0, Enumerable: false, Writable: true, Configurable: true});
        this.DefineOwnProperty('constructor',
            {Value: Narcissus.ObjectFunctionConstructor, Enumerable: false, Writable: true, Configurable: true});

        this.DefineNativeFunction('toString', 0, function (thisArg, args) {
            if (!IsCallable(thisArg))
                throw TypeError('Not a function');
            return thisArg.Native ? '[Native Function]' : '[Function]';
        });

        this.DefineNativeFunction('apply', 2, function (thisArg, args, context) {
            var func = thisArg, thisObject = args[0], argArray = args[1], len, argList = [];

            if (!IsCallable(func))
                throw TypeError('Not a function');

            if (argArray === null || argArray === undefined) {
                return func.Call(thisObject, []);
            }

            if (!IsObject(argArray))
                throw TypeError('Second argument of apply must be an object');

            len = argArray.Get('length');

            if (len === null || len === undefined)
                throw TypeError('Second argument of apply must be an object with an length property');

            /* ToDo - throw if not integer*/

            for (var i = 0; i < len; i++) {
                argList.push(argArray.Get(ToString(i)));
            }

            return func.Call(thisObject, argList, context);
        });
        
        this.DefineNativeFunction('call', 1, function (thisArg, args, context) {
            var func = thisArg, thisObject = args[0], argList = args.slice(1);

            if (!IsCallable(func))
                throw TypeError('Not a function');

            return func.Call(thisObject, argList, context);
        });        
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
        Code: undefined,
        FormalParamaters: [],
        Strict: false,

        Call: function (thisArg, args, context) {
            var functionContext, argsObject, scopeObject, env, value;

            functionContext = new ExecutionContext(FUNCTION_CODE);

            if (this.Strict) {
                functionContext.thisBinding = thisArg;
            }
            else {
                if (thisArg === null || thisArg === undefined) {
                    functionContext.thisBinding = globalObject;
                }
                else {
                    functionContext.thisBinding = ToObject(thisArg);
                }
            }

            /* old code */
            functionContext.caller = context;
            functionContext.callee = this;
            /* */
            
            functionContext.strict = this.Strict;
            
            env = newDeclarativeEnvironment(this.Scope);                    
            
            functionContext.lexicalEnvironment = env;
            functionContext.variableEnvironment = env;
            
            DoBinding(functionContext, this.Code, this, args);

            /* Let the party start */

            try {
                functionContext.execute(this.Code);
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
            var obj, proto, result;

            obj = new (Narcissus.ObjectObjectInstance);
            proto = this.Get('prototype');

            if (IsObject(proto))
                obj.Prototype = globals['Object#prototype'];
            else
                obj.Prototype = proto;

            result = this.Call(obj, args, context);
            if (IsObject(result))
                return result;

            return obj;
        },

        HasInstance: function (V) {
            var O;

            if (typeof V != 'object')
                return false;

            O = this.Get('prototype');
            if (typeof O != 'object')
                throw TypeError('prototype must be an object');

            for (V = V.Prototype; ; V = V.Prototype) {
                if (V === null)
                    return false;
                if (O === V)
                    return true;
            }
        }
    });

    function createFunction (node, context) {
        var func, proto;

        func = new (Narcissus.ObjectFunctionInstance);
        func.Scope = context.lexicalEnvironment;    
        func.Code = node.body;
        func.Strict = context.strict || func.Code.strict;        
        func.FormalParameters = node.params;
        func.Name = node.name;

        func.DefineOwnProperty('length',
            {Value: node.params.length, Enumerable: false, Writable: false, Configurable: false});
            
        func.DefineOwnProperty('name', 
            {Value: node.name, Enumerable: false, Writable: false, Configurable: false});

        proto = new (Narcissus.ObjectObjectInstance);
        proto.DefineOwnProperty('constructor',
            {Value: func, Enumerable: false, Writable: true, Configurable: true});

        func.DefineOwnProperty('prototype',
            {Value: proto, Enumerable: false, Writable: true, Configurable: false});

        if (func.Strict) {
            for (var i = 0; i < func.FormalParameters.length; i++) {
                if (func.FormalParameters[i] === 'eval') {
                    throw SyntaxError('formal parameter name "eval" is not allowed');
                }
                else if (func.FormalParameters[i] === 'arguments') {
                    throw SyntaxError('formal parameter name "arguments" is not allowed');
                }
                else if (func.FormalParameters.indexOf(func.FormalParameters[i], i + 1) > -1) {
                    throw SyntaxError('formal parameters with the same name are not allowed');
                }
            }
            
            if (func.Name === 'eval' || func.Name === 'arguments') {
                throw SyntaxError('function name eval or arguments is not allowed');
            }
        }

        return func;
    }


    /* Object */

    Narcissus.ObjectObjectConstructor = function () {
        this.Properties = {};

        this.DefineOwnProperty('prototype',
            {Value: null, Enumerable: false, Writable: false, Configurable: false});
        
        this.DefineNativeFunction('getPrototypeOf', 1, function getPrototypeOf (thisArg, args) {
            if (!IsObject(args[0]))
                throw TypeError('getPrototypeOf excpects an object')
                
            return args[0].Prototype;
        });
        
        this.DefineNativeFunction('getOwnPropertyNames', 1, function getPrototypeOf (thisArg, args) {
            if (!IsObject(args[0]))
                throw TypeError('getOwnPropertyNames excpects an object')
             
            var array = new (Narcissus.ObjectArrayInstance); 
            var i = 0;
                
            for (var key in args[0].Properties) {
                array.Put(ToString(i), key, false);
                i++;
            }            
            
            return array;
        }); 
        
        this.DefineNativeFunction('isExtensible', 1, function getPrototypeOf (thisArg, args) {
            if (!IsObject(args[0]))
                throw TypeError('isExtensible excpects an object')
                
            return args[0].Extensible;
        });
        
        this.DefineNativeFunction('keys', 1, function getPrototypeOf (thisArg, args) {
            if (!IsObject(args[0]))
                throw TypeError('getPrototypeOf excpects an object')
             
            var array = new (Narcissus.ObjectArrayInstance); 
            var i = 0;
                
            for (var key in args[0].Properties) {
                if (args[0].Properties[key].Enumerable) {
                    array.Put(ToString(i), key, false);
                    i++;
                }
            }            
            
            return array;
        });
        
        this.DefineOwnProperty('length',
            {Value: 1, Enumerable: false, Writable: false, Configurable: false});      
    };

    extend(Narcissus.ObjectObjectConstructor, Narcissus.Object, {
        Class: 'Function',
        Extensible: true,

        Call: function (thisArg, args) {
            if (args[0] === undefined || args[0] === null)
                return this.Construct(thisArg, args);

            return ToObject(args[0]);
        },

        Construct: function (thisArg, args) {
            if (args[0] === undefined || args[0] === null) {
                return new (Narcissus.ObjectObjectInstance);
            }
            else {
                return ToObject(args[0]);
            }
        }

    });


    /* Object.prototype */

    Narcissus.ObjectObjectPrototype = function () {
        this.Properties = {};

        this.DefineOwnProperty('constructor',
            {Value: Narcissus.ObjectObjectConstructor, Enumerable: false, Writable: true, Configurable: true});

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
            {Value: null, Enumerable: false, Writable: false, Configurable: false});

        this.DefineOwnProperty('length',
            {Value: 1, Enumerable: false, Writable: true, Configurable: true});

        this.DefineNativeFunction('isArray', 1, function (thisArg, args) {
            if (!IsObject(args[0]))
                return false;
            return (args[0].Class === 'Array');
        });
    }

    extend(Narcissus.ObjectArrayConstructor, Narcissus.Object, {
        Class: 'Function',
        Extensible: true,

        Call: function (thiArg, args) {
            return this.Construct(thisArg, args);
        },

        Construct: function (thiArg, args) {
            var object, len;

            if (args.length > 0) {

                if (typeof args[0] === 'number' || (IsObject(args[0]) && args[0].Class === 'Number')) {
                    len = ToNumber(args[0]);

                    if (Math.floor(len) !== len) {
                        throw RangeError('excepted an integer');
                    }

                    object = new (Narcissus.ObjectArrayInstance);
                    object.Put('length', len);

                    return object;
                }
            }

            object = new (Narcissus.ObjectArrayInstance);
            object.Put('length', args.length);

            for (var i = 0; i < args.length; i++) {
                object.DefineOwnProperty(ToString(i),
                    {Value: args[i], Enumerable: true, Writable: true, Configurable: true});
            }

            return object;
        }

    });

    /* Array.prototype */

    Narcissus.ObjectArrayPrototype = function () {
        this.Properties = {};

        this.DefineOwnProperty('constructor',
            {Value: Narcissus.ObjectArrayConstructor, Enumerable: false, Writable: true, Configurable: true});

        this.DefineNativeFunction('join', 1, function (thisArg, args) {
            var O, len, element0, element, S, R, k, next;

            O = ToObject(thisArg);
            len = Math.floor(O.Get('length'));

            if (len === 0)
                return ""; /* empty string */

            seperator = args[0];
            if (seperator === undefined)
                seperator = ',';
            else
                seperator = ToString(seperator);

            element0 = O.Get('0');
            if (element0 === undefined || element0 === null)
                R = ""; /* empty string */
            else
                R = ToString(element0);

            k = 1;
            while (k < len) {
                S = R + seperator;
                element = O.Get(String(k));
                if (element === undefined || element === null)
                    next = "";
                else
                    next = ToString(element);
                R = S + next;
                k++;
            }

            return R;
        });

        this.DefineNativeFunction('toString', 0, function (thisArg, args) {
            var array, func;
            array = ToObject(thisArg);
            func = thisArg.Get('join');
            if (!IsCallable(func)) {
                /* Hack */
                func = new (Narcissus.ObjectObjectPrototype)
                func = func.Get('toString');
            }

            return func.Call(thisArg, []);
        });
    }

    extend(Narcissus.ObjectArrayPrototype, Narcissus.Object, {
        Class: 'Array',
        Extensible: true,
    });


    /* Array Instance */

    Narcissus.ObjectArrayInstance = function () {
        this.Properties = {};

        Narcissus.Object.prototype.DefineOwnProperty.apply(this, ['length',
            {Value: 0, Writable: true, Enumerable: false, Configurable: false}, false]);
    };

    extend(Narcissus.ObjectArrayInstance, Narcissus.Object, {
        Class: 'Array',
        Extensible: true,

        DefineOwnProperty: function (P, Desc, Throw) {
            var oldLenDesc, oldLen, newLenDesc, newLen, newDesc;
            var newWritable, succeeded, cannotDelete;
            var index;

            oldLenDesc = this.GetOwnProperty('length');
            oldLen = oldLenDesc.Value;

            if (P === 'length') {

                newLen = ToNumber(Desc.Value);
                if (Math.floor(newLen) !== newLen) {
                    throw RangeError;
                }

                newLenDesc = Desc;
                newLenDesc.Value = newLen;
                newLenDesc.Configurable = false;
                newLenDesc.Enumerable = false;
                newLenDesc.Writable = true;

                if (!Desc.hasOwnProperty('Value')) {
                    return Narcissus.Object.prototype.DefineOwnProperty.apply(this, ['length', newLenDesc, Throw]);
                }

                if (newLen > oldLen) {
                    return Narcissus.Object.prototype.DefineOwnProperty.apply(this, ['length', newLenDesc, Throw]);
                }

                if (!oldLenDesc.Writable) {
                    if (Throw)
                        throw TypeError;
                    else
                        return false;
                }

                if (!newLenDesc.hasOwnProperty('Writable') || newLenDesc.Writable)
                    newWritable = true;
                else {
                    newWritable = false;
                    newLenDesc.Writable = true
                }

                succeeded = Narcissus.Object.prototype.DefineOwnProperty.apply(this, ['length', newLenDesc, Throw]);
                if (!succeeded)
                    return false;

                while (newLen < oldLen) {
                    oldLen = oldLen - 1;

                    cannotDelete = this.Delete(ToString(oldLen), false);
                    if (cannotDelete) {
                        newLenDesc.Value = oldLen + 1;
                        newLenDesc.Writable = newWritable;

                        Narcissus.Object.prototype.DefineOwnProperty.apply(this, ['length', newLenDesc, false]);

                        return false;
                    }
                }

                if (!newWritable)
                    Narcissus.Object.prototype.DefineOwnProperty.apply(this, ['length', {Writable: false}, false]);

                return true;
            }
            else {
                index = ToNumber(P);
                if (Math.floor(index) === Math.abs(index)) {
                    if (index > oldLen && !oldLenDesc.Writable) {
                        return false;
                    }

                    succeeded = Narcissus.Object.prototype.DefineOwnProperty.apply(this, [P, Desc, false]);

                    if (!succeeded)
                        return false;

                    if (index > oldLen - 1) {
                        oldLenDesc.Value = index + 1;
                        Narcissus.Object.prototype.DefineOwnProperty.apply(this, ['length', oldLenDesc, false]);
                    }

                    return true;
                }
            }

            return Narcissus.Object.prototype.DefineOwnProperty.apply(this, [P, Desc, Throw]);
        }
    });


    /* String */

    Narcissus.ObjectStringConstructor = function () {
        this.Properties = {};

        this.DefineOwnProperty('prototype',
            {Value: null, Enumerable: false, Writable: false, Configurable: false});

        this.DefineOwnProperty('length',
            {Value: 1, Enumerable: false, Writable: true, Configurable: true});
    }

    extend(Narcissus.ObjectStringConstructor, Narcissus.Object, {
        Class: 'Function',
        Extensible: true,

        Call: function (thisArg, args) {
            if (args.length == 0)
                return ""; /* empty string */

            return ToString(args[0]);
        },

        Construct: function (thisArg, args) {
            var object;

            object = new (Narcissus.ObjectStringInstance);

            if (args.length == 0)
                object.PrimitiveValue = ""; /* empty string */
            else
                object.PrimitiveValue = ToString(args[0]);
            
            object.Properties['length'].Value = object.PrimitiveValue.length;

            return object;
        }

    });

    /* String.Prototype */

    Narcissus.ObjectStringPrototype = function () {
        this.Properties = {};

        this.DefineOwnProperty('constructor',
            {Value: null, Enumerable: false, Writable: true, Configurable: true});

        this.DefineNativeFunction('toString', 0, function (thisArg, args) {
            if (typeof thisArg == 'string') {
                return thisArg;
            }
            else if (IsObject(thisArg) && thisArg.Class == 'String') {
                return thisArg.PrimitiveValue;
            }
            else {
                throw TypeError('Cannot use toString with an type other then string');
            }
        });

        this.DefineNativeFunction('valueOf', 0, function (thisArg, args) {
            if (typeof thisArg == 'string') {
                return thisArg;
            }
            else if (IsObject(thisArg) && thisArg.Class == 'String') {
                return thisArg.PrimitiveValue;
            }
            else {
                throw TypeError('Cannot use valueOf with an type other then string');
            }
        });
    };

    extend(Narcissus.ObjectStringPrototype, Narcissus.Object, {
        Class: 'String',
        Extensible: true,
        PrimitiveValue: ""
    });


    /* String Instance */

    Narcissus.ObjectStringInstance = function () {
        this.Properties = {};
        
        this.DefineOwnProperty('length',
            {Value: 0, Writable: false, Enumerable: false, Configurable: false}, false);        
    };

    extend(Narcissus.ObjectStringInstance, Narcissus.Object, {
        Class: 'String',
        Extensible: true,
        PrimitiveValue: "",
        
        GetOwnProperty: function (P) {
            var desc, index;
            
            desc = Narcissus.Object.prototype.GetOwnProperty.call(this, P);
            if (desc === undefined) {
                index = ToNumber(P);
                if (Math.abs(index) === Math.floor(index)) {
                    if (index > this.PrimitiveValue.length) {                        
                        return undefined;
                    }
                    else {
                        return {Value: this.PrimitiveValue.charAt(index), 
                            Enumerable: true, Writable: false, Configurable: false};
                    }
                }
            }
            else {
                return desc;
            }
        }
    });

    /* Number */

    Narcissus.ObjectNumberConstructor = function () {
        this.Properties = {};

        this.DefineOwnProperty('prototype',
            {Value: Narcissus.ObjectNumberPrototype, Enumerable: false, Writable: false, Configurable: false});

        this.DefineOwnProperty('length',
            {Value: 1, Enumerable: false, Writable: true, Configurable: true});

        this.DefineOwnProperty('MAX_VALUE',
            {Value: Number.MAX_VALUE, Enumerable: false, Writable: false, Configurable: false});

        this.DefineOwnProperty('MIN_VALUE',
            {Value: Number.MIN_VALUE, Enumerable: false, Writable: false, Configurable: false});

        this.DefineOwnProperty('NaN',
            {Value: NaN, Enumerable: false, Writable: false, Configurable: false});

        this.DefineOwnProperty('NEGATIVE_INFINITY',
            {Value: Number.NEGATIVE_INFINITY, Enumerable: false, Writable: false, Configurable: false});

        this.DefineOwnProperty('POSITIVE_INFINITY',
            {Value: Number.POSITIVE_INFINITY, Enumerable: false, Writable: false, Configurable: false});
    }

    extend(Narcissus.ObjectNumberConstructor, Narcissus.Object, {
        Class: 'Function',
        Extensible: true,

        Call: function (thisArg, args) {
            if (args.length == 0)
                return 0;

            return ToNumber(args[0]);
        },

        Construct: function (thisArg, args) {
            var object;

            object = new (Narcissus.ObjectNumberInstance);

            if (args.length == 0)
                object.PrimitveValue = 0;
            else
                object.PrimitveValue = ToNumber(args[0]);

            return object;
        }

    });

    /* Number.Prototype */

    Narcissus.ObjectNumberPrototype = function () {
        this.Properties = {};

        this.DefineOwnProperty('constructor',
            {Value: Narcissus.ObjectNumberConstructor, Enumerable: false, Writable: true, Configurable: true});

        this.DefineNativeFunction('toString', 0, function (thisArg, args) {
            var value, type = typeof thisArg;
            if (type == 'number')
                value = thisArg;
            else if (IsObject(thisArg) && thisArg.Class == 'Number')
                value = thisArg.PrimitiveValue;
            else
                throw TypeError('Cannot use toString with an type other then number');

            if (args.length)
                return value.toString(args[0]);
            else
                return value.toString();
        });

        this.DefineNativeFunction('valueOf', 0, function (thisArg, args) {
            if (typeof thisArg == 'number')
                return thisArg;
            else if (IsObject(thisArg) && thisArg.Class == 'Number')
                return thisArg.PrimitiveValue;
            else
                throw TypeError('Cannot use valueOf with an type other then number');
        });
    };

    extend(Narcissus.ObjectNumberPrototype, Narcissus.Object, {
        Class: 'Number',
        Extensible: true,
        PrimitiveValue: 0
    });


    /* Number Instance */

    Narcissus.ObjectNumberInstance = function () {
        this.Properties = {};
    };

    extend(Narcissus.ObjectNumberInstance, Narcissus.Object, {
        Class: 'Number',
        Extensible: true,
        PrimitiveValue: 0
    });

    /* Boolean Constructor */

    Narcissus.ObjectBooleanConstructor = function () {
        this.Properties = {};

        this.DefineOwnProperty('prototype',
            {Value: Narcissus.ObjectBooleanPrototype, Enumerable: false, Writable: false, Configurable: false});

        this.DefineOwnProperty('length',
            {Value: 1, Enumerable: false, Writable: true, Configurable: true});
    }

    extend(Narcissus.ObjectBooleanConstructor, Narcissus.Object, {
        Class: 'Function',
        Extensible: true,

        Call: function (thisArg, args) {
            return ToBoolean(args[0]);
        },

        Construct: function (thisArg, args) {
            var object;

            object = new (Narcissus.ObjectBooleanInstance);
            object.PrimitveValue = ToBoolean(args[0]);

            return object;
        }

    });


    Narcissus.ObjectBooleanPrototype = function () {
        this.Properties = {};

        this.DefineOwnProperty('constructor',
            {Value: Narcissus.ObjectBooleanConstructor, Enumerable: false, Writable: true, Configurable: true});

        this.DefineNativeFunction('toString', 0, function (thisArg, args) {
            var value, type = typeof thisArg;
            if (type == 'boolean')
                value = thisArg;
            else if (IsObject(thisArg) && thisArg.Class == 'Boolean')
                value = thisArg.PrimitiveValue;
            else
                throw TypeError('Cannot use toString with an type other then boolean');

            return value ? 'true' : 'false';
        });

        this.DefineNativeFunction('valueOf', 0, function (thisArg, args) {
            if (typeof thisArg == 'boolean')
                return thisArg;
            else if (IsObject(thisArg) && thisArg.Class == 'Boolean')
                return thisArg.PrimitiveValue;
            else
                throw TypeError('Cannot use valueOf with an type other then boolean');
        });
    };

    extend(Narcissus.ObjectBooleanPrototype, Narcissus.Object, {
        Class: 'Boolean',
        Extensible: true,
        PrimitiveValue: false
    });

    Narcissus.ObjectBooleanInstance = function () {
        this.Properties = {};
    };

    extend(Narcissus.ObjectBooleanInstance, Narcissus.Object, {
        Class: 'Boolean',
        Extensible: true,
        PrimitiveValue: false
    });


    var globals = {
        'Object': new (Narcissus.ObjectObjectConstructor),
        'Object#prototype': new (Narcissus.ObjectObjectPrototype),

        'Function': new (Narcissus.ObjectFunctionConstructor),
        'Function#prototype': new (Narcissus.ObjectFunctionPrototype),

        'Array': new (Narcissus.ObjectArrayConstructor),
        'Array#prototype': new (Narcissus.ObjectArrayPrototype),

        'String': new (Narcissus.ObjectStringConstructor),
        'String#prototype': new (Narcissus.ObjectStringPrototype),

        'Number': new (Narcissus.ObjectNumberConstructor),
        'Number#prototype': new (Narcissus.ObjectNumberPrototype),

        'Boolean': new (Narcissus.ObjectBooleanConstructor),
        'Boolean#prototype': new (Narcissus.ObjectBooleanPrototype)
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


    globalObject.DefineNativeFunction('alert', 1, function (thisArg, args) {
        return alert(ToString(args[0]));
    });

    globalObject.DefineNativeFunction('isStrict', 1, function (thisArg, args, context) {
        return context.strict;
    });
    
    globalObject.DefineNativeFunction('log', 1, function (thisArg, args, context) {
        console.log.apply(console, args);
    });


    /* ==== Set Up Object ==== */
    globalObject.DefineOwnProperty('Object',
        {Value: globals['Object'], Writable: true, Enumerable: false, Configurable: true});

    globals['Object'].Prototype = globals['Function#prototype'];
    globals['Object'].Properties['prototype'].Value = globals['Object#prototype'];
    globals['Object#prototype'].Prototype = null;
    globals['Object#prototype'].Properties['constructor'].Value = globals['Object'];

    Narcissus.ObjectObjectInstance.prototype.Prototype = globals['Object#prototype'];

    /*  ==== Set Up Function  ==== */
    globalObject.DefineOwnProperty('Function',
        {Value: globals['Function'], Writable: true, Enumerable: false, Configurable: true});

    globals['Function'].Prototype = globals['Function#prototype'];
    globals['Function'].Properties['prototype'].Value = globals['Function#prototype'];
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
    globalObject.DefineOwnProperty('String',
        {Value: globals['String'], Writable: true, Enumerable: false, Configurable: true});

    globals['String'].Prototype = globals['Function#prototype'];
    globals['String'].Properties['prototype'].Value = globals['String#prototype'];
    globals['String#prototype'].Prototype = globals['Object#prototype'];
    globals['String#prototype'].Properties['constructor'].Value = globals['String'];


    Narcissus.ObjectStringInstance.prototype.Prototype = globals['String#prototype'];

    /* ==== Set Up Number ==== */
    globalObject.DefineOwnProperty('Number',
        {Value: globals['Number'], Writable: true, Enumerable: false, Configurable: true});

    globals['Number'].Prototype = globals['Function#prototype'];
    globals['Number'].Properties['prototype'].Value = globals['Number#prototype'];
    globals['Number#prototype'].Prototype = globals['Object#prototype'];
    globals['Number#prototype'].Properties['constructor'].Value = globals['Number'];


    Narcissus.ObjectNumberInstance.prototype.Prototype = globals['Number#prototype'];

    /* ==== Set Up Boolean ==== */
    globalObject.DefineOwnProperty('Boolean',
        {Value: globals['Boolean'], Writable: true, Enumerable: false, Configurable: true});

    globals['Boolean'].Prototype = globals['Function#prototype'];
    globals['Boolean'].Properties['prototype'].Value = globals['Boolean#prototype'];
    globals['Boolean#prototype'].Prototype = globals['Object#prototype'];
    globals['Boolean#prototype'].Properties['constructor'].Value = globals['Boolean'];

    Narcissus.ObjectBooleanInstance.prototype.Prototype = globals['Boolean#prototype'];
    
    var globalEnv = newObjectEnvironment(globalObject, null);
    
    function ToPrimitive (Input, PreferredType) {
        var type;

        if (Input === null || Input === undefined)
            return Input;
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
            throw 'Did not except function in ToNumber'

        if (type == 'object' && Input !== null)
            return ToNumber(ToPrimitve(Input, 'Number'));

        return Number(Input);
    }

    function ToString (Input) {
        var type;
        type = typeof Input;

        if (type == 'object' && Input !== null) {
            return ToString(ToPrimitive(Input, 'String'));
        }
        else if (type == 'function') {
            throw 'Did not expect function in ToString';
        }
        else {
            return String(Input);
        }
    }

    function ToObject (Input) {
        var type, object;

        if (Input === null || Input === undefined)
            throw TypeError('Cannot convert ' + (Input === null ? 'null' : 'undefined') + ' to an object');

        type = typeof Input;

        if (type == 'boolean') {
            object = new (Narcissus.ObjectBooleanInstance);
            object.PrimitiveValue = Input;
            return object;
        }
        if (type == 'string') {
            object = new (Narcissus.ObjectStringInstance);
            object.PrimitiveValue = Input;
            object.Properties['length'].Value = object.PrimitiveValue.length;
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

    function IsPrimitive (v) {
        var t = typeof v;
        return (t === "object") ? v === null : t !== "function";
    }

    function SameValue (x, y) {
        if (typeof x !== typeof y)
            return false;

        if (typeof x === 'undefined')
            return true;

        if (x === null && y === null)
            return true;

        if (typeof x === 'number')
            if (isNaN (x) && isNaN(y))
                return true;

            return x === y;

        return x === y;
    }

    function IsEqual (x, y) {
        var typex = typeof x, typey = typeof y;

        if (x === null && y === null) {
            return true;
        }
        else if (x === undefined && y === undefined) {
            return true;
        }

        if (x === null && y === undefined)
            return true;
        if (x === undefined && y === null)
            return true;

        if (typex == typey) {
            if (typex == 'number')
                return x == y;
            else if (typex == 'string')
                return x == y;
            else if (typex == 'boolean')
                return x == y;

            return x === y;
        }

        if (typex == 'number' && typey == 'string')
            return IsEqual(x, ToNumber(y));
        if (typex == 'string' && typey == 'number')
            return IsEqual(ToNumber(x), y);
        if (typex == 'boolean')
            return IsEqual(ToNumber(x), y);
        if (typey == 'boolean')
            return IsEqual(x, ToNumber(y));

        if ((typex == 'string' || typex == 'number') && typey == 'object' && y !== null)
            return IsEqual(x, ToPrimitive(y));

        if (typex == 'object' && x !== null && (typey == 'string' || typey == 'number'))
            return IsEqual(ToPrimitive(x), y);

        return false;
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
    
    function IsObject (V) {
        return (typeof V == 'object' && V !== null)
    }
    
    function DoBinding (context, node, func, args) {        
        var envRec = context.variableEnvironment.envRec;
        var configurableBindings = (context.type === EVAL_CODE);
        var a, i, j, u, f;
        
        if (context.type === FUNCTION_CODE) {        
            for (var i = 0; i < func.FormalParameters.length; i++) {                
                if (i > args.length)
                    value = undefined;
                else
                    value = args[i];
                        
                if (!envRec.hasBinding(func.FormalParameters[i])) {
                    envRec.createMutableBinding(func.FormalParameters[i], false);
                }
                        
                envRec.setMutableBinding(func.FormalParameters[i], value, context.strict);            
            }
            
        }
        
        console.log(envRec);
            
        a = node.funDecls;
        for (i = 0, j = a.length; i < j; i++) {
            u = a[i]            
            
            if (!envRec.hasBinding(u.name)) {
                envRec.createMutableBinding(u.name, configurableBindings);
            }
            
            f = createFunction(a[i], context);
   
            envRec.setMutableBinding(u.name, f, context.strict); 
        }
        
        if (context.type === FUNCTION_CODE && !envRec.hasBinding('arguments')) {
            /* ToDo */
        }
                        
        a = node.varDecls;
        for (i = 0, j = a.length; i < j; i++) {
            u = a[i]; 
                           
            if (!envRec.hasBinding(u.name)) {
                envRec.createMutableBinding(u.name, configurableBindings);                
            }
            
            envRec.setMutableBinding(u.name, undefined, context.strict);
        }            
        
        
    }
    
    function CheckArgumentsEval (r) {
        var base;        
        
        if (r instanceof Reference && r.isStrictReference()) {
            base = r.getBase();

            if (base === null || base === undefined || /* Hack? */
                base instanceof ObjectEnvironment || base instanceof LexicalEnvironment) {
                
                if (r.propertyName == 'eval' || r.propertyName == 'arguments') {
                    throw SyntaxError('eval or arguments is not allowed in this context');
                }
            }
        }
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
        scope: null,
        thisObject: null,
        result: undefined,
        target: null,
        strict: false,
        
        /* new */
        variableEnvironment: null,
        lexicalEnvironment: null,
        thisBinding: null,

        execute: function(n) {
            var previousContext = ExecutionContext.current;
            ExecutionContext.current = this;
            
            if (this.type == GLOBAL_CODE) {
				this.thisBinding = globalObject;
                this.variableEnvironment = globalEnv;
                this.lexicalEnvironment = globalEnv;
			}
            
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
        var value, args, thisArg, envRec;

        console.log(Narcissus.definitions.tokens[node.type], node.type);

        switch (node.type) {

            case FUNCTION:
                if (node.functionForm === parser.DECLARED_FORM) {
                    /* this will be processed by SCRIPT */
                }
                else if (node.functionForm === parser.STATEMENT_FORM) {
                    throw 'cant use function as statement here';
                }
                else {
                    value = createFunction(node, context);
                }
                break;

            case VAR:
                for (i = 0, j = node.length; i < j; i++) {                    
                    t = node[i].name;
                    
                    if (t === 'eval' || t === 'arguments')
                        throw SyntaxError('variable definition with identifier eval or arguments is not allowed');
                    
                    r = GetIdentifierReference(context.lexicalEnvironment, t, context.strict)
                    
                    u = node[i].initializer;
                    if (!u)
                        continue;                    

                    value = GetValue(execute(u, context));                    
                    PutValue(r, value);
                }
                break;
                

            case CONST:
                throw 'const is not implemented';

            case SCRIPT:                    
                context.strict = context.strict || node.strict;                       
                
                if (context.type === GLOBAL_CODE) {
                    DoBinding(context, node);                                                 
                }                                   
                
                /* Fallthrough */
            case BLOCK:
                for (i = 0, j = node.length; i < j; i++) { /* Start executing every node */
                    execute(node[i], context);
                }
                break;

            case IF:
                if (ToBoolean(GetValue(execute(node.condition, context)))) {
                    execute(node.thenPart, context);
                }
                else if (node.elsePart) {
                    execute(node.elsePart, context);
                }
                break;
                
            case FOR:
                if (node.setup)
                    GetValue(execute(node.setup, context));
                    
                /* Fallthrough */
            case WHILE:
                while (!node.condition || GetValue(execute(node.condition, context))) {                    
                    try {
                        execute(node.body, context);
                    }
                    catch (e) {
                        if (e === BREAK)
                            break;
                            
                        throw  'ToDo'
                    }
                }
                break;
            
            case FOR_IN:
                v = Getvalue(execute(node.condition, context));
                
                if (v === null || v === undefined)
                    break;
                
                throw  'ToDo'
                
            case LIST:
                value = [];
                for (i = 0, j = node.length; i < j; i++) {
                    value.push(GetValue(execute(node[i], context)));
                }
                break;

            case CALL:
                r = execute(node[0], context);
                args = execute(node[1], context);

                f = GetValue(r);
                
                console.log(f);
                
                
                if (!IsCallable(f)) {
                    throw TypeError('not a function');
                }

                thisArg = (r instanceof Reference) ? r.base : undefined; /* 11.2.3 */
                if (r instanceof Reference) {
                    if (r.isPropertyReference()) {
                        thisArg = r.getBase();
                    }
                    else {
                        thisArg = r.getBase().implicitThisValue();
                    }
                }                
                else {
                    thisArg = undefined;
                }
                                                
                value = f.Call(thisArg, args, context);
                break;

            case NEW:
            case NEW_WITH_ARGS:
                r = execute(node[0], context);
                f = GetValue(r);

                if (IsPrimitive(f) || f.Construct === undefined) {
                    throw TypeError('not an constructor');
                }

                if (node.type === NEW_WITH_ARGS)
                    args = execute(node[1], context);
                else
                    args = [];

                value = f.Construct(null, args, context);
                break;


            case RETURN:
                context.result = GetValue(execute(node.value, context));
                throw RETURN;

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
                
                CheckArgumentsEval(r);

                PutValue(r, value, node[0]);
                break;

            case DOT:
            case INDEX:                        
                r = execute(node[0], context);
                t = GetValue(r);

                if (t === null) {
                    throw TypeError(r.propertyName + ' is null');
                }
                else if (t === undefined) {
                    throw TypeError(r.propertyName + ' is undefined');
                }                
                
                if (node.type === INDEX)
                    u = GetValue(execute(node[1], context));
                else
                    u = node[1].value;

                value = new Reference(ToObject(t), ToString(u), node, context.strict);
                break;
                
            case INCREMENT:
            case DECREMENT:
                r = execute(node[0], context);
                u = ToNumber(GetValue(r))
                
                CheckArgumentsEval(r);
                
                if (node.postfix)
                    value = u;
                    
                PutValue(r, (node.type === INCREMENT) ? ++u : --u);
                
                if (!node.postfix)
                    value = u;
                
                break;

            /* Unary Operators */
            case DELETE:
                r = execute(node[0], context);
                
                if (r instanceof Reference) {
                    if (r.isUnresolvableReference()) {
                        if (r.isStrictRefenece()) {
                            throw SyntaxError('variable is not defined')
                        }
                        else {
                            value = true;
                        }
                    }
                    else if (r.isPropertyReference()) {
                        value = ToObject(r.getBase()).Delete(r.propertyName, r.isStrictReference());
                    } 
                    else { /* Environment Record */
                        if (r.isStrictReference()) {
                            throw SyntaxError('cannot delete variable');
                        }
                        else {
                            value = (r.getBase()).deleteBinding(r.propertyName);
                        }
                    }                   
                }
                else {
                    value = true;
                }
                break;

            case VOID:
                GetValue(execute(node[0], context));
                break;

            case TYPEOF:
                t = execute(node[0], context);

                if (t instanceof Reference) {
                    if (t.isUnresolvableReference()) {
                        value = 'undefined';
                        break;
                    }
                    t = GetValue(t);
                }

                value = typeof t;
                if (value === 'object' && t !== null && t.Call !== undefined)
                    value = 'function';

                break;

            case UNARY_PLUS:
                value = ToNumber(GetValue(execute(node[0], context)));
                break;

            case UNARY_MINUS:
                value = -ToNumber(GetValue(execute(node[0], context)));
                break;

            case BITWISE_NOT:
                value = ~ToNumber(GetValue(execute(node[0], context)));
                break;

            case NOT:
                value = !ToBoolean(GetValue(execute(node[0], context)));
                break;


            /* Multiplicative Operators */
            case MUL:
                t = GetValue(execute(node[0], context));
                u = GetValue(execute(node[1], context));

                value = ToNumber(t) * ToNumber(u);
                break;

            case DIV:
                t = GetValue(execute(node[0], context));
                u = GetValue(execute(node[1], context));

                value = ToNumber(t) / ToNumber(u);
                break;

            case MOD:
                t = GetValue(execute(node[0], context));
                u = GetValue(execute(node[1], context));

                value = ToNumber(t) % ToNumber(u);
                break;

            /* Additive Operators */
            case PLUS:
                t = GetValue(execute(node[0], context));
                u = GetValue(execute(node[1], context));

                t = ToPrimitive(t);
                u = ToPrimitive(u);

                if (typeof t == 'string' || typeof u == 'string')
                    value = ToString(t) + ToString(u);
                else
                    value = ToNumber(t) + ToNumber(u);

                break;

            case MINUS:
                t = GetValue(execute(node[0], context));
                u = GetValue(execute(node[1], context));

                value = ToNumber(t) - ToNumber(u);
                break;


            /* Bitwise Shift Operators */
            case LSH:
                t = GetValue(execute(node[0], context));
                u = GetValue(execute(node[1], context));

                value = ToNumber(t) << ToNumber(u);
                break;

            case RSH:
                t = GetValue(execute(node[0], context));
                u = GetValue(execute(node[1], context));

                value = ToNumber(t) >> ToNumber(u);
                break;


            case URSH:
                t = GetValue(execute(node[0], context));
                u = GetValue(execute(node[1], context));

                value = ToNumber(t) >>> ToNumber(u);
                break;

            /* Relational Operators */
            case INSTANCEOF:
                t = GetValue(execute(node[0], context));
                u = GetValue(execute(node[1], context));

                if (!IsObject(u))
                    throw TypeError('invalid operand for instanceof');

                if (u.HasInstance === undefined)
                    throw TypeError('invalid operand for instanceof');

                return u.HasInstance(t);

            case IN:
                t = GetValue(execute(node[0], context));
                u = GetValue(execute(node[1], context));

                if (!IsObject(u))
                    throw TypeError('right operand of in must be an object');

                value = u.HasProperty(ToString(t));
                break;

            /* Equality Operators */
            case EQ:
                t = GetValue(execute(node[0], context));
                u = GetValue(execute(node[1], context));

                value = IsEqual(t, u);
                break;

            case NE:
                t = GetValue(execute(node[0], context));
                u = GetValue(execute(node[1], context));

                value = !IsEqual(t, u);
                break;

            case STRICT_EQ:
                t = GetValue(execute(node[0], context));
                u = GetValue(execute(node[1], context));

                value = (t === u);
                break;

            case STRICT_NE:
                t = GetValue(execute(node[0], context));
                u = GetValue(execute(node[1], context));

                value = (t !== u);
                break;


            case ARRAY_INIT:
                value = new (Narcissus.ObjectArrayInstance);

                for (i = 0, j = node.length; i < j; i++) {
                    if (node[i])
                        value.Put(i, GetValue(execute(node[i], context)), false);
                }
                break;

            case OBJECT_INIT:
                value = new (Narcissus.ObjectObjectInstance);

                for (i = 0, j = node.length; i < j; i++) {
                    t = node[i];

                    if (t.type === PROPERTY_INIT) {
                        value.Put(t[0].value, GetValue(execute(t[1], context)), false);
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
                value = context.thisBinding;
                break;

            case NUMBER:
            case STRING:
            case REGEXP:
                value = node.value;
                break;

            case IDENTIFIER:
                value = GetIdentifierReference(context.lexicalEnvironment, node.value, context.strict);            
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
