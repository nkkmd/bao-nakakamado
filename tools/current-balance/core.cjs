"use strict";
const {createCore}=require('../balance-options/core.cjs');
const config={id:'v061-current-hand12',hands:[12,12],pits:[0,0,0,0,6,2,2,0],threshold:6};
const reference='7f9160a2ac9a8e066efa3aeffd09b0bf99a47a8f';
const core=createCore(config,{protectLast:true,reference});
module.exports={...core,config,reference};
