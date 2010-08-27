Narcissus.interpreter2 = (function () {
    
    
    var parser = Narcissus.parser;
    var definitions = Narcissus.definitions;
    var hostGlobal = Narcissus.hostGlobal;

    // Set constants in the local scope.
    eval(definitions.consts);

    const GLOBAL_CODE = 0, EVAL_CODE = 1, FUNCTION_CODE = 2;

    function ExecutionContext(type) {
        this.type = type;
    }

    function isStackOverflow(e) {
        var re = /InternalError: (script stack space quota is exhausted|too much recursion)/;
        return re.test(e.toString());
    }
    
    
    var narcissusGlobal = {
        
        'Object' :  {
            
            
            
        }
    }
    
})();
