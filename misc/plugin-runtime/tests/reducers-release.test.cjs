const {test}=require('node:test'),assert=require('node:assert/strict');
const {load,root}=require('./source-loader.cjs');
test('plugin reducers have a single owner and are reset on removal and server switching',()=>{
  const previous=globalThis.window;globalThis.window={};
  try{
    const {store,registerPluginReducer}=load('skymp5-front/src/redux/store.js',{
      redux:require(root+'/skymp5-front/node_modules/redux'),
      './rootReducer':{baseReducers:{chatReducer:(state={list:[]})=>state,other:(state={keep:true})=>state}},
    });
    const reducer=(state={list:[]},action)=>action.type==='MESSAGE'?{list:[action.data]}:state;
    const dispose=registerPluginReducer('skymp-chat','chatReducer',reducer);store.dispatch({type:'MESSAGE',data:'server A private text'});assert.equal(store.getState().chatReducer.list.length,1);
    assert.throws(()=>registerPluginReducer('skymp-chat','chatReducer',reducer));assert.throws(()=>registerPluginReducer('other','chatReducer',reducer));
    dispose();assert.deepEqual(store.getState().chatReducer.list,[]);assert.equal(store.getState().other.keep,true);
    const disposeAgain=registerPluginReducer('skymp-chat','chatReducer',reducer);assert.deepEqual(store.getState().chatReducer.list,[]);disposeAgain();
  }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});
test('release lookup targets the fork and accepts only validated repository overrides',()=>{
  const {latestReleaseUrl}=load('skymp5-server/ts/serverRelease.ts');
  assert.equal(latestReleaseUrl(),'https://api.github.com/repos/RealHartlMax/skymp/releases/latest');
  assert.equal(latestReleaseUrl('another/project'),'https://api.github.com/repos/another/project/releases/latest');
  for(const value of ['https://example.org','../project','owner/repo/next','owner/repo?x',{}])assert.throws(()=>latestReleaseUrl(value));
});
