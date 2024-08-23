import { config } from "dotenv";
config();
import { serialize } from "next-mdx-remote/serialize";
import { readFileSync, writeFileSync, readdirSync } from "fs";
import path from "path";
import arg from "arg";
import { execSync } from "child_process";
import { question } from "readline-sync";

function execute(cmd) {
    console.log(cmd);
    try{
        const stdout = execSync(cmd,{
            encoding: "utf-8"
        });
        console.log(stdout);
    }catch(err){
        console.log(err.stdout);
    }
}

async function generateIndex(){
    const index = [];

    for (const file of files) {
      const raw_content = readFileSync(path.resolve("./news/raw/", file), {
        encoding: "utf8",
      });
      const { frontmatter } = await serialize(raw_content, {
        parseFrontmatter: true,
      });
      // console.log(mdxData.frontmatter);
      index.push({
        title: frontmatter.title,
        slug: file.slice(0, -4),
        link: frontmatter.link,
        author: frontmatter.author,
        author_short: frontmatter.author_short || "UN",
        tags: String(frontmatter.tags)
          .split(",")
          .map((el) => el.trim()),
        synopsis: frontmatter.synopsis,
        news_img: frontmatter.news_img,
        added_on: frontmatter.added_on,
      });
    }
  
    writeFileSync(
      path.resolve("./news/index.json"),
      JSON.stringify(index.sort((a,b)=>b.added_on - a.added_on), null, 2),
      { encoding: "utf-8" }
    );
    console.log(`Generated ${index.length} indexes`);
}

function commit(){
    if(!args["--commit-msg"]){
        args["--commit-msg"] = `Auto Generated Commit on ${new Date().toLocaleString("en-US")}`;
    }
    console.log("[BLOGGER] Creating Commit");
    execute(`git add ./news/`)
    execute(`git commit -m "${args['--commit-msg']}"`);
}

function push(){
    console.log("[BLOGGER] Pushing to origin");
    execute(`git push`);
}

async function flushServerCache(){
    const secret = question("Server Secret: ",{
        hideEchoBack: true
    })
    const response = await fetch(process.env.BLOG_FLUSH_WEBHOOK,{
        method: "POST",
        headers:{
            "Content-Type": "application/json",
            "X-SOURCE": "Blogger_v1.0.0"
        },
        body: JSON.stringify({
            secret: secret
        })
    });
    const data = await response.json();
    if(data.err){
        console.log(`ERROR: ${data.msg}`);
    }else{
        console.log(`${data.msg} on ${new Date(data.on).toLocaleString()}`);
    }
}

let args;
try {
  args = arg({
    "--generate": Boolean,
    "--skip-generate": Boolean,
    "--push": Boolean,
    "--commit-msg": String,
    "--commit": Boolean,
    "--verbose": Boolean,
    "--flush-server-cache": Boolean
  });
} catch (err) {
  if (err.code === "ARG_UNKNOWN_OPTION") {
    console.log(err.message);
    process.exit(-1);
  } else {
    throw err;
  }
}

if (args["--verbose"]) {
  console.log(args);
}

const files = readdirSync("./news/raw/");

if (args["--verbose"]) {
  console.log(files);
}
let generated = false;
if (!args["--skip-generate"]) {
  await generateIndex();
  generated = true;
}
if(args["--generate"] && !generated){
    await generateIndex();
    generated = true;
}
let commited = false;
if(args["--commit"]){
    commit();
    commited = true;
}

if(args["--push"]){
    push();
}

if(args["--flush-server-cache"]){
    flushServerCache();
}