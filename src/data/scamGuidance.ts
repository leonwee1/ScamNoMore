/**
 * Plain-English guidance for each scam category, shown when a type is selected.
 *
 * Held in English only, and translated on demand through the backend's
 * /translate endpoint (results cached per language). The alternative —
 * hand-writing 14 categories x 2 fields x 4 languages = 112 strings — would mean
 * a large volume of safety-critical copy in languages I cannot verify to the
 * same standard. Machine translation of vetted English is the more honest
 * trade-off here, and it keeps the wording consistent across languages.
 *
 * Keyed by the canonical English scam type used throughout the dataset.
 */
export interface ScamGuidance {
  /** What this scam is and how it typically arrives. */
  what: string;
  /** What to do about it, concretely. */
  how: string;
}

export const SCAM_GUIDANCE: Record<string, ScamGuidance> = {
  'E-commerce Scam': {
    what: 'A seller on a marketplace or social media advertises goods at an unusually low price, takes payment upfront, then never delivers and stops replying. Concert tickets, electronics and popular gadgets are common bait.',
    how: 'Pay only through the platform’s protected checkout, never by direct PayNow or bank transfer to a stranger. Insist on meeting in person for high-value items, check the seller’s review history, and treat a price far below market as the warning itself.',
  },
  'Fake Friend Call Scam': {
    what: 'Someone calls or messages claiming to be a friend or relative whose number has changed, then asks for an urgent loan or a transfer to cover an emergency.',
    how: 'Hang up and call the person back on the number you already have saved. Ask something only they would know. Never transfer money based on a request from a new or unknown number, however plausible the story.',
  },
  'Government Officials Impersonation Scam': {
    what: 'A caller claims to be from the Police, IRAS, ICA, MOH or another agency, says you are implicated in a crime or owe money, and demands payment or your Singpass details to clear it up.',
    how: 'Real agencies never demand money over the phone, never threaten immediate arrest, and never ask for Singpass logins or OTPs. Put the phone down and call the agency on its published number. Report it to the police or call 1799.',
  },
  'Inheritance Scam': {
    what: 'You are told a distant relative or wealthy stranger has left you a large estate, and that a lawyer needs fees, taxes or documents processed before it can be released.',
    how: 'Genuine inheritances never require you to send money first. Do not pay any fee and do not send identity documents. If you are unsure, verify through a lawyer you found yourself, not one the sender recommends.',
  },
  'Investment Scam': {
    what: 'A platform, chat group or "mentor" promises high or guaranteed returns on crypto, forex, gold or AI trading. Early withdrawals may work to build trust, then larger deposits become impossible to withdraw.',
    how: 'Guaranteed returns do not exist. Check whether the firm is on the MAS Financial Institutions Directory and the MAS Investor Alert List before sending anything. Be wary of any investment introduced through a dating app or social media contact.',
  },
  'Job Scam': {
    what: 'An unsolicited message, often on Telegram or WhatsApp, offers easy, well-paid tasks such as clicking, reviewing or boosting orders. You are asked to pay a deposit, training fee or commission to start or to release earnings.',
    how: 'A real employer never asks you to pay to work. Do not pay any upfront fee, and never let anyone use your bank account to receive or move money — doing so can make you a money mule and a criminal suspect.',
  },
  'Loan Scam': {
    what: 'A loan is offered by SMS, WhatsApp or a web advert with fast approval and no checks, but requires an upfront processing or insurance fee before any money is released.',
    how: 'Licensed moneylenders in Singapore may not collect fees before disbursing a loan, and may not advertise by SMS or WhatsApp. Check the Ministry of Law’s list of licensed moneylenders and never hand over your Singpass or NRIC to a lender who contacted you first.',
  },
  'Lottery Scam': {
    what: 'You are told you have won a lucky draw, jackpot or prize you never entered, and must pay a processing fee, tax or customs charge to collect it.',
    how: 'You cannot win a competition you never entered, and no legitimate prize requires payment to release. Do not pay, and do not send identity documents or bank details to claim anything.',
  },
  Others: {
    what: 'Scams that do not fit the common categories, including new tactics that appear faster than they can be named. What they share is manufactured urgency and a push to move money or hand over credentials.',
    how: 'Slow down. Verify the request independently through a number or website you looked up yourself. Do not act on pressure, and call 1799 if you want a second opinion before doing anything.',
  },
  'Phishing Scam': {
    what: 'A message or email imitating your bank, a delivery firm or a government service warns of a locked account or a pending charge, and links to a convincing fake login page that captures your credentials and OTP.',
    how: 'Never log in through a link you were sent. Open the bank’s own app or type the address yourself. Banks never ask for your OTP, PIN or full password. If you entered details on such a page, call your bank immediately and change your passwords.',
  },
  'Rental Scam': {
    what: 'A room or flat is advertised at an attractive rate, often with photos taken from a real listing. The "agent" asks for a deposit or first month’s rent to hold it, sometimes claiming to be overseas and unable to show the unit.',
    how: 'Never pay a deposit before viewing the unit in person. Verify the agent’s registration on the CEA Public Register and confirm the landlord actually owns the property. An agent who cannot meet you is reason enough to walk away.',
  },
  'Romance Scam': {
    what: 'An attentive stranger builds a relationship over weeks or months on a dating app or social media, always avoiding video calls or meeting, then introduces an emergency, a customs charge, or a can’t-miss investment.',
    how: 'Never send money or crypto to someone you have not met in person, no matter how long you have spoken. Try a reverse image search on their photos. Tell a friend or relative what is happening — an outside view is the most effective check.',
  },
  'Social Media Impersonation': {
    what: 'A scammer clones or takes over an account belonging to someone you know, then messages their contacts asking for money, OTP codes, or votes and clicks on a link.',
    how: 'Contact the person through a different channel to confirm it is really them. Never share an OTP, even with a friend. Report the cloned account to the platform and warn the person whose identity was copied.',
  },
  'Tech Support Scam': {
    what: 'A pop-up, call or email claims your device is infected or your account is compromised, and urges you to install remote-access software or call a support number so a "technician" can fix it.',
    how: 'Never install remote-access tools at the request of an unexpected caller, and never let a stranger control your screen while you log in to your bank. Apple, Microsoft and Google do not cold-call about viruses. Close the pop-up and, if you granted access, disconnect and have the device checked.',
  },
};

/** Guidance for a scam type, or undefined if it is not a known category. */
export const guidanceFor = (scamType: string): ScamGuidance | undefined =>
  SCAM_GUIDANCE[scamType];
