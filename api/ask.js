const STOP = new Set(["does","do","is","are","was","were","the","a","an","this","that","page","document","mention","mentions","have","has","there","any","about","on","of","to","for","in","and","or","with","what","which","where","when","can","could","will","would","should","tell","me"]);
function normalize(s){return String(s||"").toLowerCase().replace(/\s+/g," ").trim()}
function terms(q){return normalize(q).split(/[^a-z0-9₹%]+/).filter(x=>x.length>2&&!STOP.has(x))}
function candidates(content,question){
 const chunks=String(content||"").replace(/\r/g,"").split(/\n{2,}|(?<=[.!?।])\s+/).map(x=>x.trim()).filter(x=>x.length>=25);
 const ts=terms(question);
 return chunks.map((text,index)=>{const n=normalize(text);const hits=ts.reduce((n,t)=>n+(n.includes(t)?1:0),0);return{id:"p_"+index,text,lexical:ts.length?hits/ts.length:0}}).sort((a,b)=>b.lexical-a.lexical).slice(0,18)
}
async function jev(apiKey,state,questions){
 const response=await fetch("https://api.typesafe.ai/v1/systemone",{method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({model:"jev-latest",state,questions})});
 const body=await response.json().catch(()=>({}));
 if(!response.ok) throw new Error(body?.error?.message||body?.message||"TypeSafe API request failed");
 return body
}
export default async function handler(req,res){
 res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Headers","Content-Type");res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");
 if(req.method==="OPTIONS")return res.status(204).end();if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 const apiKey=process.env.TYPESAFE_API_KEY;if(!apiKey)return res.status(500).json({error:"TYPESAFE_API_KEY is not configured on the server"});
 const {question,content,title="",url=""}=req.body||{};if(!question||!content)return res.status(400).json({error:"question and content are required"});
 if(String(content).length>120000)return res.status(413).json({error:"Page is too large. Try a smaller page or document."});
 try{
  const pool=candidates(content,question);
  const presence=await jev(apiKey,{question,page:{title,url,content:String(content).slice(0,80000)},candidate_passages:pool.map(({id,text})=>({id,text}))},{
   answer_found:{type:"noul",instructions:"Does the provided page content contain a passage that directly answers the user's question? Answer yes only when the page contains sufficient information to answer the question, not merely related words.",criteria:{yes:"A passage on this page directly answers the user's question.",no:"The page does not contain sufficient information to answer the user's question."}}
  });
  const probability=presence?.answers?.answer_found?.noul??0;
  const found=Number(probability)>=0.5;
  if(!found)return res.status(200).json({answer_found:false,probability,evidence:null});
  if(!pool.length)return res.status(200).json({answer_found:true,probability,evidence:null});
  const evidence=await jev(apiKey,{question,candidate_passages:pool.map(({id,text})=>({id,text}))},{
   best_evidence:{type:"choice",instructions:"Which candidate passage most directly answers the user's question? Choose no_match if none provides enough information.",criteria:Object.fromEntries([...pool.map(p=>[p.id,p.text.slice(0,500)]),["no_match","No candidate passage provides sufficient evidence."]])}
  });
  const selected=evidence?.answers?.best_evidence?.choice;const match=pool.find(p=>p.id===selected);
  return res.status(200).json({answer_found:true,probability,evidence:match?{text:match.text,id:match.id}:null});
 }catch(error){return res.status(502).json({error:error.message||"Jev request failed"})}
}