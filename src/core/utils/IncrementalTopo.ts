import assert from "assert";
import { Node } from "../Node";


export abstract class TopoNode extends Node {
  rank: number = 0;
  abstract incoming(): Iterable<TopoNode>
  abstract outcoming(): Iterable<TopoNode>
}

// Class for managing incremental topological sorting
export class IncrementalTopo {
  /**
   * Adds an edge (u -> v) between two nodes and updates the topological sort.
   * @param u - Source node
   * @param v - Target node
   */
  addEdge(u: TopoNode, v: TopoNode) {
    assert(u !== v, "Self-loop not allowed");

    if (u.rank < v.rank) return;

    // Order adjustment needed (u's rank is higher than or equal to v's rank)
    // Find all descendants of v (nodes that follow v).
    const affected = new Set<TopoNode>();
    const queue = [v];
    affected.add(v);

    while (queue.length > 0) {
      const current = queue.shift()!;
      // Cycle detection: if u is found among v's descendants, a cycle would be created
      if (current === u) {
        // Rollback would happen here in a transactional implementation
        throw new Error(`Cycle detected during rank update at ${v._tag}`);
      }
      for (const neighbor of current.outcoming()) {
        if (!affected.has(neighbor)) {
          affected.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    // Update ranks of affected nodes.
    // v should have at least u.rank + 1, and its descendants should be updated accordingly.
    const sortedAffected = Array.from(affected).sort((a, b) => a.rank - b.rank);
    
    for (const node of sortedAffected) {
      let maxIncomingRank = -1;
      for (const incoming of node.incoming()) {
        maxIncomingRank = Math.max(maxIncomingRank, incoming.rank);
      }
      node.rank = Math.max(node.rank, maxIncomingRank + 1);
    }
  }
}
