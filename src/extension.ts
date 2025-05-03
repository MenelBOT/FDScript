import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import { extractFunctionsFromText, FunctionParameter, type Function } from './functionParser';

interface CompletionItemData {
  label: string;
  kind: string;
  insertText: string;
  documentation: string;
}

const FunctionList: Map<string, Function> = new Map();
const LocalFunctionList: Map<string, Function> = new Map(); // Functions from the currently active file

function parseBuiltInCompletionToFunction(fn: CompletionItemData): Function {
	const name = fn.label;
	const match = fn.insertText.match(/\((.*?)\)/);
	const params = match?.[1]?.split(',').map(p => p.trim()) || [];
	const parameters: Array<FunctionParameter> = params.map((p) => {
		const trimmed = p.trim();
		const match = trimmed.match(/^\$\{(\d+):([\w\d_]+)\}$/);
		if (!match) { return null; }
		const [, name, type] = match;
		return { name: name, type };
	}).filter((p): p is FunctionParameter => p !== null) || [];

	const returnType = fn.documentation?.match(/Return:\s*(.+)/)?.[1] ?? "None";

	const signature = `${name}(${parameters.map(p => p.type + " " + p.name ).join(", ")})`;

	return {
		name,
		parameters,
		returnType,
		signatureLabel: signature,
		documentation: fn.documentation
	};
}

function loadLocalFunctions(funs: Array<Function>) {
	funs.forEach((fn) => {
		if (FunctionList.has(fn.name) || LocalFunctionList.has(fn.name)) { return; }
		fn.source = "local";
		LocalFunctionList.set(fn.name, fn);
		FunctionList.set(fn.name, fn);
		console.log(`[fdscript] Found function in local file: ${fn.name}`);
	});
}

export function activate(context: vscode.ExtensionContext) {
	const filePath = path.join(context.extensionPath, 'src', 'completions', 'fire_script_intellisense.json');
	const rawData = fs.readFileSync(filePath, 'utf8');
	const builtInCompletions = JSON.parse(rawData) as Array<CompletionItemData>;

	for (const fn of builtInCompletions) {
		const fun = parseBuiltInCompletionToFunction(fn);
		console.log(`[fdscript] Found built-in function: ${fun.name}`);
		fun.source = "builtin";
		FunctionList.set(fn.label, fun);
	}

	const commonLoadPromise = new Promise<void>((resolve) => {
		(async () => {
			// Load common functions from _Common folder
			const commonFiles = await vscode.workspace.findFiles('**/_Common/*.scp', '**/node_modules/**');

			for (const file of commonFiles) {
				const document = await vscode.workspace.openTextDocument(file);
				const funs = extractFunctionsFromText(document.getText());
				funs.forEach((fn) => {
					if (!FunctionList.has(fn.name)) {
						fn.source = "common";
						FunctionList.set(fn.name, fn);
						console.log(`[fdscript] Found function in file: ${fn.name}`);
					}
				});
			}

			// Load currently opened file

			const editor = vscode.window.activeTextEditor;
			if (editor && editor.document.languageId === "fdscript") {
				const funs = extractFunctionsFromText(editor.document.getText());
				loadLocalFunctions(funs);
			}
			resolve();
		})();
	});

	const provider = vscode.languages.registerCompletionItemProvider('fdscript', {
		async provideCompletionItems(document, position) {
		  await commonLoadPromise;
	  
		  return [...FunctionList.values()].map(fn => {
			const item = new vscode.CompletionItem(fn.name, vscode.CompletionItemKind.Function);
			item.insertText = new vscode.SnippetString(fn.name);
	  
			// Show parameter types and return type in documentation
			const paramLines = fn.parameters.map(p => `- \`${p.name}\`: \`${p.type}\``).join('\n');
			const doc = new vscode.MarkdownString();
			doc.appendMarkdown(`**${fn.signatureLabel}**\n\n`);
			if (fn.documentation) {
			  doc.appendMarkdown(`${fn.documentation.split('\n\n')[0]}\n\n`);
			}
			if (fn.parameters.length > 0) {
			  doc.appendMarkdown(`**Parameters:**\n${paramLines}\n\n`);
			}
			doc.appendMarkdown(`**Returns:** \`${fn.returnType}\``);
			item.documentation = doc;
	  
			return item;
		  });
		}
	}, '('); // Trigger on open parenthesis

	const signatureProvider = vscode.languages.registerSignatureHelpProvider(
		'fdscript',
		{
			async provideSignatureHelp(document, position, token, context) {
				await commonLoadPromise;

				const line = document.lineAt(position).text.slice(0, position.character);
				const fnCallMatch = line.match(/(\w+)\s*\(([^()]*)$/);

				if (!fnCallMatch) { return null; }

				const fnName = fnCallMatch[1];
				const fn = FunctionList.get(fnName);
				if (!fn) { return null; }

				const activeParamIndex = fnCallMatch[2].split(',').length - 1;

				const sigInfo = new vscode.SignatureInformation(
					fn.signatureLabel,
					new vscode.MarkdownString(fn.documentation || '')
				);

				sigInfo.parameters = fn.parameters.map((p) =>
					new vscode.ParameterInformation(`${p.type} ${p.name}`, p.type)
				);

				const result = new vscode.SignatureHelp();

				result.signatures = [sigInfo];
				result.activeSignature = 0;
				result.activeParameter = Math.min(activeParamIndex, sigInfo.parameters.length - 1);

				return result;
			}
		},
		'(', ',' // Trigger characters
	);

	vscode.window.onDidChangeActiveTextEditor(async (editor) => {
		if (!editor || editor.document.languageId !== 'fdscript') { return; }

		await commonLoadPromise;

		// Clear previous local functions
		for (const [key, fn] of LocalFunctionList.entries()) {
			LocalFunctionList.delete(key);
			FunctionList.delete(key);
			console.log(`[fdscript] Removed function from local list: ${fn.name}`);
		}

		const funs = extractFunctionsFromText(editor.document.getText());

		loadLocalFunctions(funs);
	});

	context.subscriptions.push(provider);
	context.subscriptions.push(signatureProvider);
}
