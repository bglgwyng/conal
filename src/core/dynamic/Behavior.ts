import { Node } from "../Node";

export abstract class Behavior<T> extends Node {
	abstract readCurrent(): T;
}
