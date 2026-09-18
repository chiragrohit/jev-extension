import http from "node:http";
import fs from "node:fs";

try {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile();
  } else if (fs.existsSync(".env")) {
    const envContent = fs.readFileSync(".env", "utf8");
    for (const line of envContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    }
  }
} catch (err) {
  if (err.code !== "ENOENT") console.warn("Failed to load .env file:", err.message);
}

const PORT = Number(process.env.PORT || 8787);
const API_KEY = process.env.TYPESAFE_API_KEY;
if (!API_KEY) { console.error("Missing TYPESAFE_API_KEY. Set it in a .env file or environment variable."); process.exit(1); }


const STOP = new Set(["does","do","is","are","was","were","the","a","an","this","that","page","document","mention","mentions","have","has","there","any","about","on","of","to","for","in","and","or","with","what","which","where","when","can","could","will","would","should","tell","me"]);
const normalize=s=>String(s||"").toLowerCase().replace(/\s+/g," ").trim();
const terms=q=>normalize(q).split(/[^a-z0-9₹%]+/).filter(x=>x.length>2&&!STOP.has(x));
function candidates(content,question){const chunks=String(content).replace(/\r/g,"").split(/\n{2,}|(?<=[.!?।])\s+/).map(x=>x.trim()).filter(x=>x.length>=25);const ts=terms(question);return chunks.map((text,index)=>{const norm=normalize(text);const hits=ts.reduce((acc,t)=>acc+(norm.includes(t)?1:0),0);return{id:"p_"+index,text,lexical:ts.length?hits/ts.length:0}}).sort((a,b)=>b.lexical-a.lexical).slice(0,18)}

function detectGranularity(query) {
  const q = String(query || "").trim().toLowerCase();

  // Word / Entity indicators: NER, names, places, numbers, metrics, dates, single-entity questions
  if (
    /^(who|what is the name|which company|which person|what city|what country|where|how much|how many|what percentage|when|what year|what date)\b/i.test(q) ||
    /name|place|animal|thing|entity|ceo|chairman|founder|revenue|valuation|price|amount|percentage|ticker|symbol/i.test(q)
  ) {
    return "word";
  }

  // Phrase indicators: specific terms, definitions, quotes, reasons, short clauses
  if (
    /^(what does .* mean|define|quote|term|how does|why did)\b/i.test(q) ||
    q.split(/\s+/).length <= 4
  ) {
    return "phrase";
  }

  // Sentence / context default: explanations, summaries, broad questions
  return "sentence";
}

function extractGranularTarget(text, query, granularity = "auto") {
  if (!text) return "";

  const resolvedGranularity = (!granularity || granularity === "auto")
    ? detectGranularity(query)
    : granularity;

  if (resolvedGranularity === "sentence" || resolvedGranularity === "paragraph") {
    return text;
  }

  const cleanText = text.trim();
  const rawTerms = String(query || "")
    .replace(/[,"'?!.]/g, " ")
    .split(/\s+/)
    .map(t => t.trim().toLowerCase())
    .filter(t => t.length >= 2 && !STOP.has(t));

  // If word/entity level: pinpoint exact entity, metric, or query term
  if (resolvedGranularity === "word") {
    // 1. Direct query keyword match
    for (const term of rawTerms) {
      const wordRegex = new RegExp(`\\b(${term})\\b`, "i");
      const match = cleanText.match(wordRegex);
      if (match) return match[0];
    }
    // 2. Numbers, monetary or percentage values
    const numMatch = cleanText.match(/(?:[$₹€£]\s*[\d,.]+(?:\s*(?:billion|million|crore|lakh|trillion))?|[\d,.]+\s*(?:%|percent|billion|million|crore|lakh|trillion))/i);
    if (numMatch) return numMatch[0];

    // 3. Proper nouns / Named Entities (capitalized words)
    const entityMatch = cleanText.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/);
    if (entityMatch && entityMatch[0].length >= 3) {
      return entityMatch[0];
    }
  } else if (resolvedGranularity === "phrase") {
    // Extract concise clause or sub-phrase
    for (const term of rawTerms) {
      const idx = cleanText.toLowerCase().indexOf(term);
      if (idx !== -1) {
        const start = Math.max(0, cleanText.lastIndexOf(",", idx) + 1);
        let end = cleanText.indexOf(",", idx + term.length);
        if (end === -1) end = cleanText.length;
        const phrase = cleanText.slice(start, end).trim();
        if (phrase.length >= 10 && phrase.length <= 90) return phrase;
      }
    }
  }

  return cleanText;
}

async function jev(state,questions){const r=await fetch("https://api.typesafe.ai/v1/systemone",{method:"POST",headers:{"Authorization":"Bearer "+API_KEY,"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({model:"jev-latest",state,questions})});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b?.error?.message||b?.message||"TypeSafe API request failed");return b}
async function ask({question,content,title="",url="",granularity="auto"}){
  if(!question||!content)throw new Error("question and content are required");
  if(String(content).length>120000)throw new Error("Page is too large.");
  const pool=candidates(content,question);
  const p=await jev({question,page:{title,url,content:String(content).slice(0,80000)},candidate_passages:pool.map(({id,text})=>({id,text}))},{answer_found:{type:"noul",instructions:"Does the provided page content contain a passage that directly answers the user's question? Answer yes only when sufficient information is present, not merely related words.",criteria:{yes:"A passage directly answers the user's question.",no:"The page does not contain sufficient information to answer it."}}});
  const probability=p?.answers?.answer_found?.noul??0;
  if(Number(probability)<0.5)return{answer_found:false,probability,evidence:null,evidences:[]};
  if(!pool.length)return{answer_found:true,probability,evidence:null,evidences:[]};

  const criteria=Object.fromEntries([...pool.map(x=>[x.id,x.text.slice(0,500)]),["no_match","No candidate provides sufficient evidence."]]);
  const e=await jev({question,candidate_passages:pool.map(({id,text})=>({id,text}))},{
    match_1:{type:"choice",instructions:"Which candidate passage most directly answers the question? Choose no_match if none provides enough information.",criteria},
    match_2:{type:"choice",instructions:"Which other candidate passage provides direct or supporting evidence for the question? Choose no_match if none.",criteria},
    match_3:{type:"choice",instructions:"Which other candidate passage provides additional relevant evidence for the question? Choose no_match if none.",criteria}
  });

  const candidateMap=new Map(pool.map(x=>[x.id,x]));
  const scoreMap=new Map();
  for(const k of ["match_1","match_2","match_3"]){
    const ans=e?.answers?.[k];
    if(!ans)continue;
    if(ans.choice&&ans.choice!=="no_match")scoreMap.set(ans.choice,(scoreMap.get(ans.choice)||0)+1.0);
    if(ans.probabilities){
      for(const[id,prob]of Object.entries(ans.probabilities)){
        if(id!=="no_match"&&prob>0.04)scoreMap.set(id,(scoreMap.get(id)||0)+prob);
      }
    }
  }

  const rankedIds=[...scoreMap.entries()].sort((a,b)=>b[1]-a[1]).map(([id])=>id);
  if(!rankedIds.length&&pool.length)rankedIds.push(pool[0].id);

  const resolvedGranularity = (!granularity || granularity === "auto") ? detectGranularity(question) : granularity;
  const evidences=rankedIds.map(id=>candidateMap.get(id)).filter(Boolean).slice(0,5).map(x=>{
    const targetText = extractGranularTarget(x.text, question, resolvedGranularity);
    return { text: x.text, targetText, id: x.id };
  });
  const primary=evidences[0]||null;
  return{answer_found:true,probability,evidence:primary,evidences,granularity:resolvedGranularity};
}

async function scanSentiment({content}){
  if(!content)throw new Error("content is required");
  const rawSentences=String(content)
    .replace(/\r/g,"")
    .split(/\n{2,}|(?<=[.!?।])\s+/)
    .map(s=>s.trim())
    .filter(s=>s.length>=30&&s.length<=280&&!/cookie|copyright|terms|privacy|newsletter|subscribe|http/i.test(s));

  const maxSamples=18;
  const step=Math.max(1,Math.floor(rawSentences.length/maxSamples));
  const sample=[];
  for(let i=0;i<rawSentences.length&&sample.length<maxSamples;i+=step){
    sample.push({id:"s_"+sample.length,text:rawSentences[i]});
  }

  if(!sample.length){
    return{summary:{positive:0,negative:0,neutral:0},items:[]};
  }

  const questions={};
  sample.forEach(s=>{
    questions["sent_"+s.id]={
      type:"choice",
      instructions:'What is the general sentiment of the following statement: "'+s.text.replace(/"/g,"'")+'"?',
      criteria:{
        positive:"Favorable performance, strong growth, success, advantage, or optimistic outlook.",
        negative:"Decline, loss, risk, drop in profit, warning, challenge, or pessimistic outlook.",
        neutral:"Factual, descriptive, neutral context, question, or background information."
      }
    };
  });

  const b=await jev({},questions);
  const items=[];
  const summary={positive:0,negative:0,neutral:0};

  sample.forEach(s=>{
    const ans=b?.answers?.["sent_"+s.id];
    const sentiment=ans?.choice||"neutral";
    const confidence=ans?.confidence||0.5;
    if(summary[sentiment]!==undefined)summary[sentiment]++;
    items.push({
      id:s.id,
      text:s.text,
      sentiment,
      confidence
    });
  });

  return{summary,items};
}

async function scanCustom({content,prompt,granularity="auto"}){
  if(!content)throw new Error("content is required");
  if(!prompt)throw new Error("prompt is required");

  const rawSentences=String(content)
    .replace(/\r/g,"")
    .split(/\n{2,}|(?<=[.!?।])\s+/)
    .map(s=>s.trim())
    .filter(s=>s.length>=30&&s.length<=280&&!/cookie|copyright|terms|privacy|newsletter|subscribe|http/i.test(s));

  const maxSamples=18;
  const step=Math.max(1,Math.floor(rawSentences.length/maxSamples));
  const sample=[];
  for(let i=0;i<rawSentences.length&&sample.length<maxSamples;i+=step){
    sample.push({id:"cs_"+sample.length,text:rawSentences[i]});
  }

  const resolvedGranularity = (!granularity || granularity === "auto") ? detectGranularity(prompt) : granularity;

  if(!sample.length){
    return{prompt,granularity:resolvedGranularity,summary:{totalScanned:0,matchedCount:0},items:[]};
  }

  const cleanPrompt=prompt.replace(/"/g,"'").trim();
  const questions={};
  sample.forEach(s=>{
    questions["m_"+s.id]={
      type:"noul",
      instructions:'Does the following statement mention, contain, reference, or discuss: '+cleanPrompt+' (or related entities, concepts, or instances)?\nStatement: "'+s.text.replace(/"/g,"'")+'"',
      criteria:{
        yes:'The statement mentions, contains, or discusses '+cleanPrompt+' (or matching entities/instances).',
        no:'The statement does not mention, contain, or discuss '+cleanPrompt+'.'
      }
    };
  });

  const b=await jev({},questions);
  const items=[];
  let matchedCount=0;

  sample.forEach(s=>{
    const ans=b?.answers?.["m_"+s.id];
    const probability=Number(ans?.noul??0);
    const matched=probability>=0.50;
    if(matched)matchedCount++;
    const targetText = matched ? extractGranularTarget(s.text, prompt, resolvedGranularity) : s.text;
    items.push({
      id:s.id,
      text:s.text,
      targetText,
      matched,
      probability
    });
  });

  // Sort items so matched ones come first
  items.sort((a,b)=>b.probability-a.probability);

  return{
    prompt,
    granularity:resolvedGranularity,
    summary:{totalScanned:sample.length,matchedCount},
    items
  };
}

const server=http.createServer(async(req,res)=>{
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");
  if(req.method==="OPTIONS")return res.writeHead(204).end();

  if(req.method!=="POST"||(req.url!=="/api/ask"&&req.url!=="/api/sentiment"&&req.url!=="/api/custom-scan")){
    return res.writeHead(404,{"Content-Type":"application/json"}).end(JSON.stringify({error:"Not found"}));
  }

  let raw="";
  req.on("data",c=>{raw+=c;if(raw.length>500000)req.destroy()});
  req.on("end",async()=>{
    try{
      const body=JSON.parse(raw);
      let result;
      if(req.url==="/api/ask"){
        result=await ask(body);
      }else if(req.url==="/api/sentiment"){
        result=await scanSentiment(body);
      }else if(req.url==="/api/custom-scan"){
        result=await scanCustom(body);
      }
      res.writeHead(200,{"Content-Type":"application/json"}).end(JSON.stringify(result));
    }catch(e){
      res.writeHead(400,{"Content-Type":"application/json"}).end(JSON.stringify({error:e.message||"Request failed"}));
    }
  });
});
server.listen(PORT,"127.0.0.1",()=>console.log("Jev local server: http://127.0.0.1:"+PORT+"/api/ask"));