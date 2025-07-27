export function affine<T>(fn: () => T): Affine<T> {
	let isCalled = false;
	return () => {
		if (isCalled) throw new Error("Already called");
		isCalled = true;

		return fn();
	};
}

export type Affine<T> = () => T;
