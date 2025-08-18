import { beforeEach, describe, expect, it } from "vitest";
import {
	IncrementalTopo,
	type TopoNode,
} from "../../../src/core/utils/IncrementalTopo";

// Mock Node class for testing
class MockNode implements TopoNode {
	rank: number = 0;
	readonly #incoming: Set<TopoNode> = new Set();
	readonly #outgoing: Set<TopoNode> = new Set();

	constructor(public readonly topology: IncrementalTopo) {}

	incomings(): Set<TopoNode> {
		return this.#incoming;
	}

	outgoings(): Set<TopoNode> {
		return this.#outgoing;
	}

	addEdge(v: MockNode) {
		this.#outgoing.add(v);
		v.#incoming.add(this);

		this.topology.reorder(this, v);
	}

	_tag?: string;
	tag(tag: string): this {
		this._tag = tag;
		return this;
	}
}

describe("IncrementalTopo", () => {
	let topo: IncrementalTopo;
	let nodeA: MockNode;
	let nodeB: MockNode;
	let nodeC: MockNode;
	let nodeD: MockNode;

	beforeEach(() => {
		topo = new IncrementalTopo();
		nodeA = new MockNode(topo).tag("A");
		nodeB = new MockNode(topo).tag("B");
		nodeC = new MockNode(topo).tag("C");
		nodeD = new MockNode(topo).tag("D");
	});

	describe("constructor", () => {
		it("should create an empty IncrementalTopo instance", () => {
			expect(topo).toBeInstanceOf(IncrementalTopo);
		});
	});

	describe("addEdge", () => {
		describe("basic edge addition", () => {
			it("should add edge between two nodes", () => {
				nodeA.addEdge(nodeB);

				expect(nodeA.outgoings().has(nodeB)).toBe(true);
				expect(nodeB.incomings().has(nodeA)).toBe(true);
			});

			it("should update ranks when adding edge", () => {
				// Initially both nodes have rank 0
				expect(nodeA.rank).toBe(0);
				expect(nodeB.rank).toBe(0);

				nodeA.addEdge(nodeB);

				// A -> B means B should have higher rank
				expect(nodeA.rank).toBe(0);
				expect(nodeB.rank).toBe(1);
			});

			it("should handle multiple edges from same source", () => {
				nodeA.addEdge(nodeB);
				nodeA.addEdge(nodeC);

				expect(nodeA.outgoings().has(nodeB)).toBe(true);
				expect(nodeA.outgoings().has(nodeC)).toBe(true);
				expect(nodeB.incomings().has(nodeA)).toBe(true);
				expect(nodeC.incomings().has(nodeA)).toBe(true);

				// Both B and C should have rank 1
				expect(nodeB.rank).toBe(1);
				expect(nodeC.rank).toBe(1);
			});

			it("should handle chain of dependencies", () => {
				nodeA.addEdge(nodeB); // A -> B
				nodeB.addEdge(nodeC); // B -> C
				nodeC.addEdge(nodeD); // C -> D

				// Check edges
				expect(nodeA.outgoings().has(nodeB)).toBe(true);
				expect(nodeB.outgoings().has(nodeC)).toBe(true);
				expect(nodeC.outgoings().has(nodeD)).toBe(true);

				// Check ranks: A(0) -> B(1) -> C(2) -> D(3)
				expect(nodeA.rank).toBe(0);
				expect(nodeB.rank).toBe(1);
				expect(nodeC.rank).toBe(2);
				expect(nodeD.rank).toBe(3);
			});
		});

		describe("rank propagation", () => {
			it("should propagate ranks through dependency chain", () => {
				// Create chain: A -> B -> C
				nodeA.addEdge(nodeB);
				nodeB.addEdge(nodeC);

				// Add D -> A, which should increase ranks of A, B, C
				nodeD.rank = 5; // Set D to high rank
				nodeD.addEdge(nodeA);

				// A should get rank 6, B should get rank 7, C should get rank 8
				expect(nodeA.rank).toBe(6);
				expect(nodeB.rank).toBe(7);
				expect(nodeC.rank).toBe(8);
			});

			it("should handle complex dependency graphs", () => {
				// Create diamond pattern: A -> B, A -> C, B -> D, C -> D
				nodeA.addEdge(nodeB);
				nodeA.addEdge(nodeC);
				nodeB.addEdge(nodeD);
				nodeC.addEdge(nodeD);

				// Check that D has the highest rank
				expect(nodeA.rank).toBe(0);
				expect(nodeB.rank).toBe(1);
				expect(nodeC.rank).toBe(1);
				expect(nodeD.rank).toBe(2);
			});
		});

		describe("duplicate edge handling", () => {
			it("should ignore duplicate edges", () => {
				nodeA.addEdge(nodeB);
				const initialRankB = nodeB.rank;

				// Adding same edge again should be ignored
				nodeA.addEdge(nodeB);

				expect(nodeA.outgoings().size).toBe(1);
				expect(nodeB.incomings().size).toBe(1);
				expect(nodeB.rank).toBe(initialRankB);
			});
		});

		describe("self-loop prevention", () => {
			it("should throw error on self-loop", () => {
				expect(() => {
					nodeA.addEdge(nodeA);
				}).toThrow("Self-loop not allowed");
			});
		});

		describe("cycle detection", () => {
			it("should detect simple cycle", () => {
				nodeA.addEdge(nodeB);
				nodeB.addEdge(nodeC);

				// Adding C -> A should create a cycle and throw error
				expect(() => {
					nodeC.addEdge(nodeA);
				}).toThrow("Cycle detected during rank update at A");
			});

			it("should detect cycle in complex graph", () => {
				// Create: A -> B -> C -> D
				nodeA.addEdge(nodeB);
				nodeB.addEdge(nodeC);
				nodeC.addEdge(nodeD);

				// Adding D -> B should create a cycle
				expect(() => {
					nodeD.addEdge(nodeB);
				}).toThrow("Cycle detected during rank update at B");
			});

			it("should detect cycle with multiple paths", () => {
				// Create diamond: A -> B, A -> C, B -> D, C -> D
				nodeA.addEdge(nodeB);
				nodeA.addEdge(nodeC);
				nodeB.addEdge(nodeD);
				nodeC.addEdge(nodeD);

				// Adding D -> A should create cycle
				expect(() => {
					nodeD.addEdge(nodeA);
				}).toThrow("Cycle detected during rank update at A");
			});

			it("should allow valid edges that don't create cycles", () => {
				nodeA.addEdge(nodeB);
				nodeC.addEdge(nodeD);

				// These should not create cycles
				expect(() => {
					nodeA.addEdge(nodeC);
					nodeB.addEdge(nodeD);
				}).not.toThrow();

				// Verify edges were added
				expect(nodeA.outgoings().has(nodeC)).toBe(true);
				expect(nodeB.outgoings().has(nodeD)).toBe(true);
			});
		});

		describe("rank consistency", () => {
			it("should maintain rank consistency after multiple operations", () => {
				// Build complex graph
				nodeA.addEdge(nodeB);
				nodeB.addEdge(nodeC);
				nodeA.addEdge(nodeD);
				nodeD.addEdge(nodeC);

				// Verify rank consistency: parent rank < child rank
				expect(nodeA.rank).toBeLessThan(nodeB.rank);
				expect(nodeB.rank).toBeLessThan(nodeC.rank);
				expect(nodeA.rank).toBeLessThan(nodeD.rank);
				expect(nodeD.rank).toBeLessThan(nodeC.rank);
			});

			it("should handle rank updates when adding edges to existing graph", () => {
				// Create initial chain
				nodeA.addEdge(nodeB);
				nodeB.addEdge(nodeC);

				// Set D to high rank and add edge to A
				nodeD.rank = 10;
				nodeD.addEdge(nodeA);

				// All downstream nodes should have updated ranks
				expect(nodeA.rank).toBe(11);
				expect(nodeB.rank).toBe(12);
				expect(nodeC.rank).toBe(13);
			});
		});
	});

	describe("edge cases and error conditions", () => {
		it("should handle nodes with pre-existing ranks", () => {
			nodeA.rank = 5;
			nodeB.rank = 3;

			nodeA.addEdge(nodeB);

			// B should get rank 6 (A's rank + 1)
			expect(nodeB.rank).toBe(6);
		});

		it("should handle adding edge where target already has higher rank", () => {
			nodeA.rank = 2;
			nodeB.rank = 5;

			nodeA.addEdge(nodeB);

			// B should keep its higher rank
			expect(nodeB.rank).toBe(5);
			expect(nodeA.outgoings().has(nodeB)).toBe(true);
		});

		it("should handle large graphs efficiently", () => {
			const nodes: MockNode[] = [];

			// Create 50 nodes
			for (let i = 0; i < 50; i++) {
				const node = new MockNode(topo).tag(`node{i}`);
				nodes.push(node);
			}

			// Create chain: node0 -> node1 -> ... -> node49
			for (let i = 0; i < 49; i++) {
				expect(() => {
					nodes[i].addEdge(nodes[i + 1]);
				}).not.toThrow();
			}

			// Verify ranks are correct
			for (let i = 0; i < 50; i++) {
				expect(nodes[i].rank).toBe(i);
			}

			// Adding edge from last to first should create cycle
			expect(() => {
				nodes[49].addEdge(nodes[0]);
			}).toThrow("Cycle detected");
		});
	});

	describe("integration scenarios", () => {
		it("should handle complex real-world dependency scenario", () => {
			// Simulate a build system with dependencies
			const libA = new MockNode(topo).tag("libA");
			const libB = new MockNode(topo).tag("libB");
			const libC = new MockNode(topo).tag("libC");
			const app = new MockNode(topo).tag("app");
			const tests = new MockNode(topo).tag("tests");

			// Dependencies: libA -> libB -> libC, app depends on libB and libC, tests depend on app
			libA.addEdge(libB);
			libB.addEdge(libC);
			libB.addEdge(app);
			libC.addEdge(app);
			app.addEdge(tests);

			// Verify proper ordering
			expect(libA.rank).toBeLessThan(libB.rank);
			expect(libB.rank).toBeLessThan(libC.rank);
			expect(libB.rank).toBeLessThan(app.rank);
			expect(libC.rank).toBeLessThan(app.rank);
			expect(app.rank).toBeLessThan(tests.rank);

			// Adding circular dependency should fail
			expect(() => {
				tests.addEdge(libA);
			}).toThrow("Cycle detected");
		});
	});
});
