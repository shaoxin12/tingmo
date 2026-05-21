// LLM Refinement Provider interface and System Prompt

export interface DictEntry {
  word: string;
  replace: string;
}

export interface RefineContext {
  language?: string;
  dictionary?: DictEntry[];
}

export interface RefinementResult {
  refinedText: string;
  originalText: string;
  provider: string;
  durationMs: number;
}

export interface IRefinementProvider {
  readonly name: string;

  /** Refine raw ASR text into structured, clean output */
  refine(rawText: string, context?: RefineContext): Promise<RefinementResult>;

  /** Translate text to a target language */
  translate(text: string, targetLang: string, context?: RefineContext): Promise<RefinementResult>;
}

function buildDictHint(dictionary?: DictEntry[]): string {
  if (!dictionary || dictionary.length === 0) return '';
  const items = dictionary.map(e => `"${e.word}" → "${e.replace}"`).join('、');
  return `\n5. 以下词汇是用户的专属词汇，请保持不替换、不修改其写法：${items}`;
}

const BASE_PROMPT = `你是一个语音输入润色助手。请对语音识别结果做以下处理：
1. 删除填充词：嗯、啊、就是、那个、然后、反正、这个、呃
2. 根据内容自动结构化：
   - 如果是罗列或分点说明 → 用 Markdown 列表
   - 如果是步骤或要求 → 用编号
   - 如果是叙述 → 保持段落
3. 补全标点符号（中英文正确混用）
4. 保持原意，不添加、不编造、不删减实质内容{dict_hint}
直接返回润色后的文字，不要任何解释或前缀。`;

export function buildRefinePrompt(dictionary?: DictEntry[]): string {
  return BASE_PROMPT.replace('{dict_hint}', buildDictHint(dictionary));
}

const TRANSLATE_BASE = `You are a translator. Translate the following text into {targetLang}.
Preserve the structure (lists, paragraphs, numbering).{dict_hint}
Output only the translated text, no explanations.`;

export function buildTranslatePrompt(targetLang: string, dictionary?: DictEntry[]): string {
  return TRANSLATE_BASE
    .replace('{targetLang}', targetLang)
    .replace('{dict_hint}', dictionary?.length ? `\nPreserve these terms exactly as written: ${dictionary.map(e => e.replace).join(', ')}` : '');
}
