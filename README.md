# cpp-include-complete README

This extension provides autocompletion when typing C++ #include statements. It searches the configured include directories to provide suggestions, and also suggests standard headers.

## Features

Just begin typing an #include statement.

When you type < or " to begin the file name, the extension will scan your include directories to provide suggestions. When you enter a directory separator (/ or \), it will then search within child directories to continue providing suggestions.

The extension uses the same c_cpp_properties.json file as the Microsoft C++ Tools extension to configure the include directories to search. Add additional directories to your platform's includePath setting to include it in suggestions. You can use `${workspaceFolder}` in include paths to spcify the current open workspace path.

![example](https://raw.githubusercontent.com/zishu-zy/cpp-include-complete/master/images/example_0.gif)

## Extension Settings

This extension contributes the following settings:

* `cpp-include-complete.postfix`:  An array of postfixes to recognise files as headers.

## Release Notes

This project is a reconstruction based on [vscode-include-autocomplete](https://github.com/ajshort/vscode-include-autocomplete), and the [vscode-include-autocomplete](https://github.com/ajshort/vscode-include-autocomplete) project has not been updated for 3 years. Especially, it does not support the multi-workspace mechanism of VScode, so I created this project based on it to support the multi-workspace mechanism

### 0.0.1

Initialize Project.

### 0.0.3

Add ICONS and project PS.
