# cpp-include-complete README

This extension provides autocompletion when typing C++ #include statements. It searches the configured include directories to provide suggestions, and also suggests standard headers.

## Features

Just begin typing an #include statement.

When you type < or " to begin the file name, the extension will scan your include directories to provide suggestions. When you enter a directory separator (/ or \), it will then search within child directories to continue providing suggestions.

The extension uses the same c_cpp_properties.json file as the Microsoft C++ Tools extension to configure the include directories to search. Add additional directories to your platform's includePath setting to include it in suggestions. You can use `${workspaceFolder}` in include paths to spcify the current open workspace path.

![example](https://zishuzy.coding.net/p/open_source/d/cpp-include-complete/git/raw/master/images/example_0.gif)

## Extension Settings

This extension contributes the following settings:

* `cpp-include-complete.postfix`:  An array of postfixes to recognise files as headers.

## Release Notes

### 0.0.1

Initialize Project.
