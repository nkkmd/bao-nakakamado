'use strict';
// MIT. Evict cache roots, then collect unreachable immutable proof nodes.
class ProofStore {
 constructor(maxCache){this.maxCache=maxCache;this.nodes=new Map();this.positive=new Map();this.frames=[];
  this.stats={collections:0,removedNodes:0,evictedRoots:0,peakNodes:0};}
 pin(children){const frame={children};this.frames.push(frame);return frame;}
 unpin(frame){if(this.frames.pop()!==frame)throw Error('proof frame order mismatch');}
 cache(key,item){if(!this.positive.has(key)&&this.positive.size>=this.maxCache)this.positive.delete(this.positive.keys().next().value);this.positive.set(key,item);}
 mark(){const live=new Set(),pending=[];for(const f of this.frames)for(const edge of f.children)pending.push(edge.to);
  for(const v of this.positive.values())pending.push(v.id);
  while(pending.length){const id=pending.pop();if(live.has(id))continue;const n=this.nodes.get(id);if(!n)throw Error('dangling retained proof reference');
   live.add(id);for(const e of n.children)pending.push(e.to);}return live;}
 collect(targetSize){this.stats.collections++;this.stats.peakNodes=Math.max(this.stats.peakNodes,this.nodes.size);
  let live=this.mark();while(live.size>targetSize&&this.positive.size){const remove=Math.max(1,Math.ceil(this.positive.size/2));
   for(let i=0;i<remove;i++){this.positive.delete(this.positive.keys().next().value);this.stats.evictedRoots++;}live=this.mark();}
  const before=this.nodes.size;for(const id of this.nodes.keys())if(!live.has(id))this.nodes.delete(id);
  this.stats.removedNodes+=before-this.nodes.size;return {before,after:this.nodes.size,cacheRoots:this.positive.size};}
}
module.exports={ProofStore};
