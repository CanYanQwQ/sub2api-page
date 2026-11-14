export type CodeLanguage = 'Node.js' | 'Python' | 'cURL'

const shellQuote = (value: string) => "'" + value.replace(/'/g, "'\"'\"'") + "'"

export function createSnippet(language: CodeLanguage, endpoint: string, model: string) {
  const safeEndpoint = JSON.stringify(endpoint)
  const safeModel = JSON.stringify(model)
  if (language === 'Python') {
    return `import os\nfrom openai import OpenAI\n\nclient = OpenAI(\n    api_key=os.environ["LANCHAO_API_KEY"],\n    base_url=${safeEndpoint}\n)\n\nstream = client.chat.completions.create(\n    model=${safeModel},\n    messages=[{"role": "user", "content": "你好，岚潮。"}],\n    stream=True\n)\nfor chunk in stream:\n    print(chunk.choices[0].delta.content or "", end="")`
  }
  if (language === 'cURL') {
    const payload = JSON.stringify({ model, messages: [{ role: 'user', content: '你好，岚潮。' }], stream: true }, null, 2)
    return [
      `curl ${shellQuote(`${endpoint}/chat/completions`)}`,
      '  -H "Authorization: Bearer $LANCHAO_API_KEY"',
      '  -H "Content-Type: application/json"',
      `  -d ${shellQuote(payload)}`,
    ].join(' \\\n')
  }
  return `import OpenAI from 'openai';\n\nconst client = new OpenAI({\n  apiKey: process.env.LANCHAO_API_KEY,\n  baseURL: ${safeEndpoint}\n});\n\nconst stream = await client.chat.completions.create({\n  model: ${safeModel},\n  messages: [{ role: 'user', content: '你好，岚潮。' }],\n  stream: true\n});\n\nfor await (const chunk of stream) {\n  process.stdout.write(chunk.choices[0]?.delta?.content ?? '');\n}`
}

// 输出文本节点而非 HTML，模型名等公开配置不会进入 v-html。
export function tokenizeCode(code: string): { text: string; kind: string }[] {
  const pattern = /('[^'\n]*'|"[^"\n]*"|\b(?:import|from|const|new|await|for|of|in|true|True|print|stream|curl)\b)/g
  const tokens = []
  let previous = 0
  for (const match of code.matchAll(pattern)) {
    if (match.index > previous) tokens.push({ text: code.slice(previous, match.index), kind: 'plain' })
    tokens.push({ text: match[0], kind: /^['"]/.test(match[0]) ? 'string' : 'keyword' })
    previous = match.index + match[0].length
  }
  if (previous < code.length) tokens.push({ text: code.slice(previous), kind: 'plain' })
  return tokens
}
