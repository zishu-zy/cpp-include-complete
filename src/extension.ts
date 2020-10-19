import { dirname, extname, join } from "path";
import * as fs from "fs";
import * as std from "./std-headers";
import * as vscode from "vscode";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "cpp-include-complete" is now active!');

    const provider = new CIncludeCompletion();
    for (const lang of ["c", "cpp"]) {
        context.subscriptions.push(
            vscode.languages.registerCompletionItemProvider(lang, provider, "<", '"', "/", "\\")
        );
    }
}

// this method is called when your extension is deactivated
export function deactivate() {}

interface IWorkspaceInfo {
    workspacePath: string;
    propertyPath: string;
    propertyJson: undefined;
    completionDirs: [];
}

class CIncludeCompletion implements vscode.CompletionItemProvider, vscode.Disposable {
    private infoWorkspaces = new Map();
    private watcher: vscode.FileSystemWatcher;

    constructor() {
        this.updateInfoWorkspaces();

        this.watcher = vscode.workspace.createFileSystemWatcher("**/c_cpp_properties.json");
        this.watcher.onDidCreate(() => this.updateInfoWorkspaces());
        this.watcher.onDidChange(() => this.updateInfoWorkspaces());
        this.watcher.onDidDelete(() => this.updateInfoWorkspaces());
    }

    public dispose() {
        this.watcher.dispose();
    }

    public async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[]> {
        console.log("doc:", document.uri.fsPath);
        let wsInfo = undefined;
        for (const info of this.infoWorkspaces.values()) {
            console.log("workspace: ", info.workspacePath);
            if (document.uri.fsPath.indexOf(info.workspacePath) == 0) {
                wsInfo = info;
                break;
            }
        }
        if (typeof wsInfo === "undefined") {
            console.log("workspace don't found");
            return Promise.all([]).then(() => []);
        }

        const text = document.lineAt(position.line).text.substr(0, position.character);
        const match = text.match(/^\s*#\s*include\s*(<[^>]*|"[^"]*)$/);
        if (!match) {
            return Promise.all([]).then(() => []);
        }
        const delimiter = match[1].substr(0, 1);
        const contents = match[1].substr(1);

        let dirs = wsInfo.completionDirs.slice();
        let postfixes: string[] = vscode.workspace
            .getConfiguration("cpp-include-complete")
            .get("postfix", []);
        // console.log("postfixes: ", postfixes);
        if (delimiter === "<") {
            dirs.push(dirname(document.uri.fsPath));
        } else {
            dirs.unshift(dirname(document.uri.fsPath));
        }
        console.log("dirs: ", dirs);

        // Append already typed path parts. If no path parts are typed, include the standard headers.
        let headers: vscode.CompletionItem[];
        let separator = Math.max(contents.lastIndexOf("/"), contents.lastIndexOf("\\"));

        if (separator !== -1) {
            dirs = dirs.map((dir: string) => join(dir, contents.substr(0, separator)));
        } else {
            if (vscode.languages.match("c", document)) {
                headers = std.C.map(
                    (header) => new vscode.CompletionItem(header, vscode.CompletionItemKind.File)
                );
            } else if (vscode.languages.match("cpp", document)) {
                headers = std.CPP.map(
                    (header) => new vscode.CompletionItem(header, vscode.CompletionItemKind.File)
                );
            }
        }
        // console.log("dirs: ", dirs);

        // Scan each directory and return the completion items.
        const seen = new Set<string>();

        const promises: vscode.CompletionItem[] = dirs.map(async (dir: string) => {
            if (!(await exists(dir))) {
                return [];
            }
            // console.log("dir: ", dir);
            const entries = await readdirAndStat(dir);
            const unseen = Object.keys(entries).filter((k) => !seen.has(k) && k.charAt(0) != ".");

            unseen.forEach((val) => seen.add(val));
            // console.log("unseen: ", unseen);

            return unseen.reduce((items: vscode.CompletionItem[], entry: string) => {
                if (entries[entry].isDirectory()) {
                    items.push(new vscode.CompletionItem(entry, vscode.CompletionItemKind.Folder));
                } else if (postfixes.indexOf(extname(entry)) !== -1) {
                    items.push(new vscode.CompletionItem(entry, vscode.CompletionItemKind.File));
                }
                return items;
            }, []);
        });

        return Promise.all(promises)
            .then((items) => {
                let t = items.reduce(
                    (a: vscode.CompletionItem[], b) => a.concat(<vscode.CompletionItem>b),
                    []
                );
                return t;
            })
            .catch((error) => {
                return [];
            });
    }

    private async updateInfoWorkspaces() {
        console.log("updateInfoWorkspaces");
        const platform = this.getPlatform();

        let infoWorkspaces = new Map();

        for (let folder of <ReadonlyArray<vscode.WorkspaceFolder>>(
            vscode.workspace.workspaceFolders
        )) {
            let workspace: IWorkspaceInfo = {
                workspacePath: folder.uri.fsPath,
                propertyPath: join(folder.uri.fsPath, ".vscode/c_cpp_properties.json"),
                propertyJson: undefined,
                completionDirs: [],
            };
            infoWorkspaces.set(folder.uri.fsPath, workspace);
            console.log("folder: ", workspace.workspacePath);
        }

        for (const workspace of infoWorkspaces.values()) {
            let property = undefined;
            if (await exists(workspace.propertyPath)) {
                try {
                    console.log(workspace.propertyPath, "is exists");
                    property = JSON.parse(await readFile(workspace.propertyPath, "utf-8"));
                    workspace.propertyJson = property;
                } catch (err) {}
            }

            if (typeof property !== "undefined") {
                const config = property["configurations"].find(
                    (c: { name: string }) => c.name === platform
                );

                if (typeof config !== "undefined") {
                    workspace.completionDirs = config.includePath;
                }
            }
            // If we couldn't read a properties file, use default paths.
            if (workspace.completionDirs.length == 0) {
                if (platform === "Win32") {
                    workspace.completionDirs = [
                        "C:/Program Files (x86)/Microsoft Visual Studio 14.0/VC/include",
                    ];
                } else {
                    workspace.completionDirs = ["/usr/include", "/usr/include/c++"];
                }
            }
            let defIndex = workspace.completionDirs.indexOf("${default}");
            if (defIndex !== -1) {
                workspace.completionDirs.splice(defIndex, 1);
            }

            workspace.completionDirs = workspace.completionDirs.map(
                (dir: {
                    replace: (
                        arg0: string,
                        arg1: string | undefined
                    ) => {
                        (): any;
                        new (): any;
                        replace: { (arg0: string, arg1: string | undefined): string; new (): any };
                    };
                }) => {
                    return dir
                        .replace("${workspaceRoot}", workspace.workspacePath)
                        .replace("${workspaceFolder}", workspace.workspacePath)
                        .replace("/**", "")
                        .replace("\\**", "");
                }
            );
        }

        for (const workspace of infoWorkspaces.values()) {
            console.log("workspace info: ", workspace);
        }

        this.infoWorkspaces = infoWorkspaces;
    }

    private getPlatform(): string {
        switch (process.platform) {
            case "linux":
                return "Linux";
            case "darwin":
                return "Mac";
            case "win32":
                return "Win32";
            default:
                return process.platform;
        }
    }
}

async function exists(path: string): Promise<boolean> {
    return new Promise((c, e) => {
        fs.stat(path, (err, start) => {
            c(err ? false : true);
        });
    });
}

function readdir(path: string): Promise<string[]> {
    return new Promise((c, e) => fs.readdir(path, (err, files) => (err ? e(err) : c(files))));
}

function readFile(filename: string, encoding: string): Promise<string> {
    return new Promise((c, e) =>
        fs.readFile(filename, encoding, (err, data) => (err ? e(err) : c(data)))
    );
}

function stat(path: string): Promise<fs.Stats> {
    return new Promise((c, e) => fs.stat(path, (err, stats) => (err ? e(err) : c(stats))));
}

async function readdirAndStat(path: string): Promise<{ [entry: string]: fs.Stats }> {
    const result = <any>{};
    const files = await readdir(path);

    await Promise.all(
        files.map(async (file) => {
            try {
                result[file] = await stat(`${path}/${file}`);
            } catch (err) {}
        })
    );

    return result;
}
