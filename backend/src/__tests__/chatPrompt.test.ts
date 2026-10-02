import { CHAT_SYSTEM_PROMPT, buildAppDataContext } from '../lib/prompts';

describe('chatbot product guide', () => {
  it('documents the current navigation and analysis gates', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain('The bottom tabs are exactly: Home, Search, Report, Community.');
    expect(CHAT_SYSTEM_PROMPT).toContain('"I understand and continue"');
    expect(CHAT_SYSTEM_PROMPT).toContain('The Home "Latest verified cases" list shows verified records');
    expect(CHAT_SYSTEM_PROMPT).toContain('Matching cases are sorted newest date first.');
    expect(CHAT_SYSTEM_PROMPT).toMatch(/2\) select the "Town" and "Scam Type"[\s\S]*3\) enter the "Date of/);
  });

  it('documents persistence, privacy boundaries and current voice behavior', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain('persistent SQLite database');
    expect(CHAT_SYSTEM_PROMPT).toMatch(/private\s+incident description is not returned/);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/up to\s+60 seconds\s+of inactivity/);
    expect(CHAT_SYSTEM_PROMPT).toContain('input this message: ...');
    expect(CHAT_SYSTEM_PROMPT).toContain('"No" or the selected-language equivalent means cancel');
    expect(CHAT_SYSTEM_PROMPT).toContain('Voice commands ARE supported');
    expect(CHAT_SYSTEM_PROMPT).not.toContain("The app doesn't support voice commands for navigation");
  });

  it('limits general scam links to approved official sources', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain('https://www.scamshield.gov.sg/check-for-scams/');
    expect(CHAT_SYSTEM_PROMPT).toContain('https://www.police.gov.sg/Advisories/Scams');
    expect(CHAT_SYSTEM_PROMPT).toMatch(/Never invent a\s+URL/);
    expect(CHAT_SYSTEM_PROMPT).toContain('about S$913.1 million lost in Singapore in 2025');
  });

  it('keeps app-data instructions separate from the product guide', () => {
    const context = buildAppDataContext({ totalCases: 5003, userReports: 3 });
    expect(context).toContain('APP CASE RECORDS');
    expect(context).toContain('never present them as official');
    expect(context).toContain('5003');
  });
});
