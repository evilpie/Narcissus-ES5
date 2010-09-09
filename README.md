Narcissus-ES5
=============


This is an interpreter rewrite of the original Narcissus js-js interpreter created by Brendan Eich.



Implementation Status:
---------------------

- Basic Object Functions like [[Get]] , [[ Call]] or [[HasInstance]] are implemented
- The Objects 'String', 'Number', 'Object', 'Function' and 'Boolean' are defined
- assignment without a previous var declaration works
- typeof, instanceof
- calling native functions
- getting properties via Dot (.) or Brackets ([])
- string literals, null literal, undefined literal, number literal, object literal

ToDo:
-----

- implement all functions of the object like String.fromCharCode, Object.getPrototypeOf
- implement Error Objects
- function and var definitions
- all operators like + - * /
- strict mode
- the bugs we will entcounter :)



