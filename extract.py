import json
import re

with open(r'docs\10-References\LangGraphAgent', 'r', encoding='utf-8') as f:
    text = f.read()

# We can find all literal strings inside the script tags: self.__next_f.push([1, "..."])
chunks = re.findall(r'self\.__next_f\.push\(\[\s*\d+,\s*"(.*?)"\s*\]\)', text, re.DOTALL)

with open('scratch_extracted_md.md', 'w', encoding='utf-8') as out:
    for c in chunks:
        try:
            # these are json strings, so we decode them with json.loads
            s = '"' + c + '"'
            decoded = json.loads(s)
            
            # Since Next.js sends strings that are parts of the DOM, some might have "T5be,\n## State Schema..."
            if '\\n##' in c or '##' in decoded or '```python' in decoded:
                # remove leading Next.js identifiers like "24:T5be," or "1c:[\"$\",..."
                clean = re.sub(r'^[0-9a-zA-Z]+:.*?,\n', '', decoded)
                out.write(clean + '\n\n')
        except:
            pass

print('Done')
