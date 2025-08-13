export abstract class Node {
	_tag?: string;

	tag(tag: string): this {
		this._tag = tag;
		return this;
	}
}
