# NewBigSemantics
The new BigSemantics with a focus on supporting web-based applications.

## Build

1. Install [Node](https://github.com/joyent/node).
2. Install [TypeScript](https://github.com/Microsoft/TypeScript) (1.5.0-beta or above).
3. Install [TSD](http://definitelytyped.org/tsd/).
4. <code>cd src</code>.
4. Install Node packages: <code>npm install</code>.
5. Install TypeScript definitions: <code>tsd install --save</code>.
6. Compile target TypeScript files into JavaScript. For example: <code>tsc --module commonjs phantomteer.ts</code>.
7. Run compiled JavaScript file with Node: <code>node phantomteer.js</code>.
