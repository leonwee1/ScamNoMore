import { toSimplifiedChinese, toSimplifiedChineseList } from '../lib/chinese';
import { buildChatLanguageContext, buildLanguageContext, buildTranslationPrompt } from '../lib/prompts';

describe('Simplified Chinese output', () => {
  it('converts Traditional transcript characters to Simplified', () => {
    expect(toSimplifiedChinese('謝謝你，再見。轉寫文字（可編輯）')).toBe(
      '谢谢你，再见。转写文字（可编辑）'
    );
  });

  it('keeps non-Chinese text intact while converting a list', () => {
    expect(toSimplifiedChineseList(['DBS', '請勿轉賬'])).toEqual(['DBS', '请勿转账']);
  });

  it('instructs every Chinese model path to use Simplified characters', () => {
    expect(buildLanguageContext('zh')).toContain('Simplified Chinese characters');
    expect(buildChatLanguageContext('zh')).toContain('Simplified Chinese characters');
    expect(buildTranslationPrompt('zh')).toContain('Simplified Chinese characters');
  });
});
