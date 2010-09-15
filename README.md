Narcissus-ES5
=============


This is an interpreter rewrite of the original Narcissus js-js interpreter created by Brendan Eich.



Implementation Status:
---------------------

- Basic Object Functions like [[Get]] , [[Call]] or [[HasInstance]] are implemented
- The Objects 'String', 'Number', 'Object', 'Function' and 'Boolean' are defined
- typeof, instanceof
- calling native functions
- getting properties via Dot (.) or Brackets ([])
- string literals, null literal, undefined literal, number literal, object literal
- strict mode partially done
- function and var definitions

ToDo:
-----

- implement all functions of the object like String.fromCharCode, Object.getPrototypeOf
- implement Error Objects
- all operators like + - * /
- finish arguments object properties to formal parameter binding



