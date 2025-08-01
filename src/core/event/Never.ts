import type { Maybe } from "../utils/Maybe";
import { Event } from "./Event";

export class Never<T> extends Event<T> {
	getEmittedValue(): Maybe<T> {
		return;
	}
}
