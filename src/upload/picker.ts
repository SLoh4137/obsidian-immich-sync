export function pickImages(): Promise<File[]> {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "image/*";
		input.multiple = true;
		input.addEventListener("change", () => {
			resolve(Array.from(input.files ?? []));
		});
		input.addEventListener("cancel", () => {
			resolve([]);
		});
		input.click();
	});
}
