const functionPattern = /^(\w+)\s+(\w+)\s*\(([^)]*)\)\s*{/gm;

export interface FunctionParameter {
	name: string; // foo
	type: string; // s32, mcString, etc.
}

export interface Function {
	name: string; // MyFunction
	returnType: string; // void
	parameters: Array<FunctionParameter>;
	signatureLabel: string; // MyFunction(s32 foo, mcString bar)
	documentation?: string; // Optional documentation string
	source?: "builtin" | "common" | "local";
}  

function parseFunction(textFn: RegExpExecArray): Function {
	const [, returnType, name, paramString] = textFn;
	const params = paramString
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean)
		.map((p) => {
			const [type, paramName] = p.split(/\s+/);
			return { name: paramName || "", type };
		});

	return {
		name,
		returnType,
		parameters: params,
		signatureLabel: `${name}(${params.map((p) => p.name).join(", ")})`	
	};
}

export function extractFunctionsFromText(text: string): Array<Function> {
	const matches = [...text.matchAll(functionPattern)];
	return matches.map(parseFunction);
}