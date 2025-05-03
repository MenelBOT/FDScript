# FDScript

IntelliSense and syntax highlighting for Fire Department 2 and 3 `.scp` scripting files.

## Features

- Syntax highlighting for built-in types, literals, comments, etc.
- IntelliSense and autocompletion for built-in and custom functions
- Signature help showing parameter hints and return types
- Context-aware parsing of the current file and `_Common` folder

## Usage

Just open any `.scp` file and start typing!

## Extension Capabilities

- Highlights: `f32`, `s32`, `mcString`, `EntityID`, etc.
- Completion: Built-ins, _Common scripts, active file functions
- Signature help: Shows documentation and parameter list as you type

## Known Issues

- No "go to definition" yet (planned).
- Functions are only parsed from the currently active file, not all open tabs.

## License

MIT
