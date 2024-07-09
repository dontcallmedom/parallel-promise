const specSelector = document.getElementById("spec");
const algos = document.getElementById("algos");

const { results } = await (await fetch("./index.json")).json();
const algoUrls = new Set(await (await fetch("./dfns.json")).json());

specSelector.addEventListener("change", showSpec);

results.sort((a,b) => a.title.localeCompare(b.title)).forEach(s => {
  if (s.algorithms) {
    const opt = document.createElement("option");
    opt.dataset.spec = s.shortname;
    opt.value = s.algorithms;
    opt.textContent = s.title;
    specSelector.append(opt);
  }
});

const m = window.location.search.match(/\?s=(.+)$/);
if (m) {
  const spec = m[1];
  specSelector.value = specSelector.querySelector(`option[data-spec="${spec}"]`)?.value;
  specSelector.dispatchEvent(new Event("change"));
}

let contextualParallel;
function showAlgo(a, level = 0, parallel = false) {
  if (level === 0 || level < contextualParallel) {
    contextualParallel = undefined;
  }
  const ret = [];
  if (level === 0) {
    const heading = document.createElement("h2");
    if (a.name) {
      if (a.href) {
	const link = document.createElement("a");
	link.textContent = a.name;
	link.href = a.href;
	heading.append(link);
      } else {
	heading.textContent = a.name;
      }
    } else {
      heading.textContent = "(unnamed algorithm)";
    }
    ret.push(heading);
  }
  let embedParallel = false;
  let remainingParallel = false;
  let thread = "main";
  const symbols = [];
  if (a.html) {
    const intro = document.createElement("div");
    intro.innerHTML = a.html;
    // duplicate content
    if (intro.children[0]?.tagName === "OL") {
      intro.innerHTML = "";
    }
    const linkUrls = new Set([...intro.querySelectorAll("a[href]")].map(n => n.href));
    const text = intro.textContent.toLowerCase().trim()
	  .replace(/^([a-z]+:) /, '')
    ;
    remainingParallel = (text.includes("remaining steps") || text.includes("remainder") || text.includes("continue running")) && text.includes("in parallel") && (level > 0 || (level === 0 && !text.includes(" synchronous")));
    if (remainingParallel) {
      contextualParallel = level;
    }
    embedParallel = !remainingParallel && text.includes("in parallel");

    thread = embedParallel || parallel || contextualParallel >= level ? "parallel" : "main";

    if ((level === 0 && text.includes(" synchronous")) || text.startsWith("⌛")) {
      thread = "main";
    }
    if ((text.includes("queue") && text.includes("task")) || text.includes("await a stable state")) {
      thread = "queued";
    }

    if (embedParallel || remainingParallel) {
      intro.classList.add("invoke-parallel");
    }

    if (level > 0 && (text.startsWith("let") || text.includes(". let"))) {
      symbols.push("init");
    }
    if (level > 0 && (text.startsWith("if") || text.startsWith("otherwise") || text.startsWith("while"))) {
      symbols.push("condition");
    }
    if (level > 0 && (text.includes("jump") && text.includes("step") || text.includes("break"))) {
      symbols.push("jump");
    }
    if (level > 0 && algoUrls.intersection(linkUrls).size > 0) {
      symbols.push("invoke");
    }

    if (level > 0 && text.includes("return")) {
      symbols.push("return");
    }
    intro.dataset.comment =  `${level}, ${contextualParallel}, ${parallel}`;
    symbols.toReversed().forEach(type => {
      const span = document.createElement("span");
      span.className = type;
      span.classList.add("step-type");
      let sym;
      switch(type) {
      case "init":
	sym = "⬡";
	break;
      case "condition":
	sym = "◇";
	break;
      case "jump":
	sym = "⏩";
	break;
      case "invoke":
	sym = "▥";
	break;
      case "return":
	sym = "⏎";
	break;
      }
      span.textContent = sym;
      intro.prepend(span);
    });
    ret.push(intro);
  }
  if (!a.steps) return ret;
  const container = document.createElement(a.operation === "switch" ? "dl" : "ol");
  container.className = "level" + level;
  for (const step of a.steps) {
    if (step.case) {
      const dt = document.createElement("dt");
      dt.innerHTML = step.case;
      const dd = document.createElement("dd");
      dd.append(...showAlgo(step, level + 1, parallel || embedParallel));
      dd.classList.add(thread);
      dt.className = thread;
      const span = document.createElement("span");
      span.className = "condition";
      span.textContent = "◇";
      dt.prepend(span);
      container.append(dt, dd);
    } else {
      const li = document.createElement("li");
      li.className = thread;
      li.append(...showAlgo(step, level + 1, parallel || embedParallel));
      container.append(li);
    }
  }
  ret.push(container);
  const additional = a.additional ?? a.additionalAlgorithms;
  if (additional) {
    const div = document.createElement("div");
    div.className = "additional";
    div.append("Additional:", ...additional.map(aa => showAlgo(aa, level +1)).flat());
    ret.push(div);
  }
  if (a.ignored) {
    const div = document.createElement("div");
    div.className = "ignored";
    div.textContent = "Ignored: " + a.ignored;
    ret.push(div);
  }
  return ret;
}

async function showSpec(e) {

  const specShortname = specSelector.children[specSelector.selectedIndex].dataset.spec;
  history.pushState({}, "", "?s=" + specShortname);
  const { algorithms } = await (await fetch(e.target.value)).json();
  algos.innerHTML = "";
  for (const a of algorithms) {
    const section = document.createElement("section");
    section.append(...showAlgo(a));
    algos.append(section);
  }
}
