(function () {
    
    var extend = function(child, parent, proto) {
        var ctor = function(){};
        ctor.prototype = parent.prototype;
        child.prototype = new ctor();
        child.prototype.constructor = child;
        for (key in proto) {
            child.prototype[key] = proto[key];
        }
    };    
    
    
    
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
        
        
        Put: function () {
        },
        CanPut: function () {
        },
        
        HasProperty: function () {
        },        
        
        Delete: function () {
        },
        
        DefaultValue: function () {
        },
        
        DefineOwnProperty: function (P, Desc, Throw) {
            var current, extensible;

            current = this.GetOwnProperty(P);
            extensible = this.Extensible;
            
            console.log('[' + this.Class + '] P: ' + P + ' HasIt: ' + !!current + ' Extensible: ' + extensible);

            if (current === undefined && !extensible)
                return false;

            if (current === undefined && extensible) {
                if (IsDataDescriptor(Desc)) {
                    this.Properties[P] = {};
                    this.Properties[P].Value = Desc.Value || undefined;
                    this.Properties[P].Writable = Desc.Writable || false;
                    this.Properties[P].Enumerable = Desc.Enumerable || false;
                    this.Properties[P].Configurable = Desc.Configurable || false;
                }
            }                                
        },
                

        /* Extended */
        
        DefineNativeFunction: function (name, length, func) {
            var o;
            
            /* ToDo The real logic */
            
            o = {};
            o.Value = func
            o.Writable = true;
            o.Enumerable = false;
            o.Configurable = true;
            o.Native = true;
            
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
    var globalObject = new (Narcissus.ObjectObjectInstance)();        
    
    globalObject.Extensible = true;
    globalObject.Call = undefined;
    globalObject.Construct = undefined;
    globalObject.Class = 'Global';
    globalObject.Prototype = null;
    
    /* Set Up Object */    
    globalObject.DefineOwnProperty('Object', 
        {value: globals['Object'], Writable: true, Enumerable: false, Configurable: true});
    
    globals['Object'].Prototype = globals['Function#prototype'];
    globals['Object'].Properties['prototype'].Value = globals['Object#prototype'];
        

    globals['Object#prototype'].Prototype = null;

    /* Set Up Function */    
    globalObject.DefineOwnProperty('Function', 
        {value: globals['Function'], Writable: true, Enumerable: false, Configurable: true});
     
    globals['Function'].Prototype = globals['Function#prototype'];
    globals['Function'].Properties['prototype'].Value = globals['Functon#prototype'];
    globals['Function#prototype'].Prototype = globals['Object#prototype']
    globals['Function#prototype'].Properties['constructor'].Value = globals['Function'];           
    
    
    /* Testzzz */
    
    
    /* ToDo Function Stubs (Hackzzzz) */
    
    function ToObject (x) {
        return Object(x);
    }
    
    function IsCallable(func) {
        return !!ToObject(x).Call;
    }        
    
    /* Helper */
    
    function IsAccessorDescriptor(Desc) {
        if (Desc === undefined)
            return false;

        if (!Desc.hasOwnProperty('Get') && !Desc.hasOwnProperty('Set'))
            return false

        return true;
    }

    function IsDataDescriptor(Desc) {
        if (Desc === undefined)
            return false;

        if (!Desc.hasOwnProperty('Value') && !Desc.hasOwnProperty('Writable'))
            return false;

        return true;
    }
    

    
})();
