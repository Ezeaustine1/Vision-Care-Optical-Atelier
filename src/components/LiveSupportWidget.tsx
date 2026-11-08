import React, { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  X,
  Send,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronDown,
  Bot,
  RotateCcw,
} from 'lucide-react';
import { UserProfile, OrderRecord, EnquiryRecord, Product, LensType } from '../types.ts';
import { formatNaira } from './OpticalImage.tsx';

interface LiveSupportWidgetProps {
  user: UserProfile | null;
  orders: OrderRecord[];
  enquiries: EnquiryRecord[];
  products?: Product[];
  lensTypes?: LensType[];
  onEnquirySubmitted: (newEnquiry: EnquiryRecord) => void;
}

const QUICK_TOPICS = [
  'Prescription & Lens Advice',
  'Order & Lab Surfacing Status',
  'Special Order / Varilux Inquiry',
  'Frame Sizing & Fitting Help',
];

const AI_QUICK_REPLIES = [
  'How do I upload my prescription?',
  'Which lens type fits my prescription?',
  'Single Vision vs Bifocal vs Varilux?',
  'Blue Cut Photo AR vs Photo AR?',
  'How to order Designer Frames Only?',
  'Show popular frames & prices',
  'Book an Eye Appointment & Fees',
];

interface AiChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
}

const INITIAL_AI_MESSAGE: AiChatMessage = {
  id: 'welcome-ai',
  sender: 'bot',
  text: 'Welcome to Vision Care Optical Assistant! Tap any quick-reply question below or type your question about uploading your prescription, choosing lens types (Single Vision, Bifocal, Varilux, or Protective 0.00 Plano), Designer Frames Only, or frame pricing.',
};

export const LiveSupportWidget: React.FC<LiveSupportWidgetProps> = ({
  user,
  orders,
  enquiries,
  products = [],
  lensTypes = [],
  onEnquirySubmitted,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'ai_chat' | 'compose' | 'history'>('ai_chat');

  const [customerName, setCustomerName] = useState(user?.fullName || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [orderNumber, setOrderNumber] = useState('');
  const [subject, setSubject] = useState('Prescription & Lens Advice');
  const [message, setMessage] = useState('');

  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successBanner, setSuccessBanner] = useState('');
  const [localEnquiries, setLocalEnquiries] = useState<EnquiryRecord[]>([]);

  // Quick-Reply AI Chatbot state
  const [aiMessages, setAiMessages] = useState<AiChatMessage[]>([INITIAL_AI_MESSAGE]);
  const [aiInput, setAiInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (user?.fullName) setCustomerName(user.fullName);
    if (user?.email) setCustomerEmail(user.email);
  }, [user?.fullName, user?.email]);

  useEffect(() => {
    if (isOpen && activeTab === 'ai_chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiMessages, isAiThinking, isOpen, activeTab]);

  // Combine account enquiries with any guest enquiries submitted in this browser session
  const combinedEnquiries = React.useMemo(() => {
    const map = new Map<number, EnquiryRecord>();
    enquiries.forEach((e) => map.set(e.id, e));
    localEnquiries.forEach((e) => map.set(e.id, e));
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [enquiries, localEnquiries]);

  const repliedCount = combinedEnquiries.filter(
    (e) => e.adminReply && e.adminReply.trim().length > 0
  ).length;

  const buildLocalFallbackReply = (question: string): string => {
    const q = question.toLowerCase();
    if (q.includes('upload') || q.includes('ocr') || q.includes('how do i upload') || q.includes('pd')) {
      return 'To upload your prescription:\n• Click "Order Prescription Lenses" on the home page (or "Select Lenses & Customize" on any frame).\n• Choose "Complete Prescription Glasses" or "Replacement Lenses".\n• In Step 2, select "Option B: Upload Prescription Photo / PDF (AI OCR)" to upload a JPG, PNG, or PDF slip and auto-extract OD/OS SPH, CYL, AXIS, ADD, and PD—or enter them manually in Option A.';
    }
    if (q.includes('blue cut') || q.includes('photo ar') || q.includes('protective')) {
      return 'For Non-Prescription Protective & Screen Glasses (0.00 Plano):\n• Choose "Protective & Screen Glasses (Without Prescription)" in Step 1 and click Continue.\n• The wizard skips Lens Design (with ₦0 lens design charge) and routes directly to Coatings & Index.\n• Select Blue Cut Photo AR (Photochromic + Blue Cut Digital Filter + Anti-Reflective) or Photo AR (Photochromic Sun-Adaptive + Anti-Reflective).';
    }
    if (q.includes('frame only') || q.includes('frames only') || q.includes('designer frame')) {
      return 'To purchase Designer Frames Only:\n• Select "Designer Frames Only" in Step 1 (Order Type) and click Continue.\n• You are directed straight to "Select Frame" (Prescription, Lens Design, and Coatings & Index are removed for frame-only orders).\n• Pick your frame and colour finish, then proceed to Review & Checkout.';
    }
    if (q.includes('appointment') || q.includes('exam') || q.includes('consultation') || q.includes('fee')) {
      return 'You can book an eye examination under "Book Eye Appointment":\n• View the consultation fee and any applicable clinical charges upfront.\n• Enter or upload your brief medical history (allergies, past eye conditions) for the Doctor.\n• Track your appointment and access approved prescriptions in My Account.';
    }
    if (q.includes('which lens') || q.includes('single vision') || q.includes('bifocal') || q.includes('varilux') || q.includes('lens type')) {
      const activeLenses = lensTypes.filter((l) => l.isActive);
      const lensText =
        activeLenses.length > 0
          ? activeLenses
              .slice(0, 4)
              .map((l) => `${l.name} (${formatNaira(l.priceNgn)})`)
              .join(', ')
          : 'Single Vision, Fused Bifocal, Invisible Bifocal, and Varilux Progressive';
      return `Our system automatically matches your prescription to the right lens:\n• SPH and/or CYL+AXIS without ADD → Single Vision Lens\n• SPH + ADD → Fused Bifocal, Invisible Bifocal, or Varilux Progressive\n• CYL + AXIS + ADD → Special Order Bifocal, Invisible Bifocal, or Varilux\nAvailable options include ${lensText}.`;
    }
    const activeFrames = products.filter((p) => p.isActive).slice(0, 4);
    if (activeFrames.length > 0) {
      const list = activeFrames
        .map((p) => `${p.name} (${formatNaira(p.discountPriceNgn || p.priceNgn)})`)
        .join(', ');
      return `Popular Vision Care frames in stock right now include: ${list}. You can customize any frame with prescription lenses, 0.00 Plano protective coatings, or purchase the Designer Frame Only!`;
    }
    return 'You can upload a JPG/PNG/PDF prescription slip for instant AI OCR extraction, or choose from Single Vision, Fused/Invisible Bifocal, Varilux Progressive, and 0.00 Plano Protective lenses.';
  };

  const handleAskAiQuestion = async (rawQuestion: string) => {
    const trimmed = rawQuestion.trim();
    if (!trimmed || isAiThinking) return;

    const userMsg: AiChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: trimmed,
    };
    const nextHistory = [...aiMessages, userMsg];
    setAiMessages(nextHistory);
    setAiInput('');
    setIsAiThinking(true);

    try {
      const res = await fetch('/api/support/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          history: nextHistory.slice(-6).map((m) => ({ sender: m.sender, text: m.text })),
        }),
      });
      const data = await res.json();
      const replyText =
        res.ok && data.reply ? String(data.reply) : buildLocalFallbackReply(trimmed);
      setAiMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          sender: 'bot',
          text: replyText,
        },
      ]);
    } catch {
      setAiMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          sender: 'bot',
          text: buildLocalFallbackReply(trimmed),
        },
      ]);
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessBanner('');

    const finalName = (customerName || user?.fullName || '').trim();
    const finalEmail = (customerEmail || user?.email || '').trim();
    const finalSubject = subject.trim() || 'Live Support Enquiry';
    const finalMessage = message.trim();

    if (!finalName || !finalEmail || !finalMessage) {
      setErrorMsg('Please provide your name, email address, and message.');
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userUid: user?.uid || '',
          customerName: finalName,
          customerEmail: finalEmail,
          orderNumber: orderNumber.trim(),
          subject: finalSubject,
          message: finalMessage,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not send support message.');
      }

      setLocalEnquiries((prev) => [data, ...prev]);
      onEnquirySubmitted(data);
      setMessage('');
      setSuccessBanner(
        'Message delivered to Vision Care Admin & Optical Concierge. We will reply shortly.'
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-50 flex flex-col items-end max-w-[calc(100vw-1.5rem)]">
      {/* Expanded Chat / Enquiry Panel */}
      {isOpen && (
        <div className="mb-3 w-[calc(100vw-2rem)] sm:w-[400px] md:w-[420px] bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[82vh] sm:max-h-[620px]">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#0B192C] via-[#132847] to-[#0B192C] text-white p-3.5 sm:p-4 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative p-2 rounded-xl bg-[#C5A059]/15 border border-[#C5A059]/40 text-[#C5A059] shrink-0">
                <MessageCircle className="w-5 h-5" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0B192C] absolute -top-0.5 -right-0.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold text-white truncate">Live Optical Support</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium shrink-0">
                    Online
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 truncate">
                  Quick-Reply AI Optical Assistant & Concierge
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              aria-label="Minimize Live Support"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* Sub-navigation Tabs */}
          <div className="bg-[#FAF9F6] border-b border-slate-200 px-2.5 py-2 flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('ai_chat')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
                activeTab === 'ai_chat'
                  ? 'bg-[#0B192C] text-white'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
              <span>AI Quick-Reply</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('compose')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'compose'
                  ? 'bg-[#0B192C] text-white'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              Send Message
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
                activeTab === 'history'
                  ? 'bg-[#0B192C] text-white'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              <span>Enquiries ({combinedEnquiries.length})</span>
              {repliedCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-[#C5A059] text-[#0B192C] text-[10px] font-bold">
                  {repliedCount}
                </span>
              )}
            </button>
          </div>

          {/* Body Content */}
          <div className="p-3.5 sm:p-4 overflow-y-auto space-y-3.5 flex-1 min-h-0">
            {activeTab === 'ai_chat' ? (
              <div className="flex flex-col h-full space-y-3">
                {/* Quick-Reply Question Pills */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Instant Quick-Reply Questions
                    </span>
                    {aiMessages.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setAiMessages([INITIAL_AI_MESSAGE])}
                        className="text-[10px] font-semibold text-slate-500 hover:text-[#0B192C] flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        <span>Reset Chat</span>
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-0.5">
                    {AI_QUICK_REPLIES.map((q) => (
                      <button
                        key={q}
                        type="button"
                        disabled={isAiThinking}
                        onClick={() => handleAskAiQuestion(q)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#E0F2FE]/80 hover:bg-[#E0F2FE] text-[#0B192C] border border-[#1E40AF]/20 transition-colors cursor-pointer disabled:opacity-50 text-left"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Conversation Thread */}
                <div className="space-y-2.5 max-h-56 sm:max-h-64 overflow-y-auto pr-1">
                  {aiMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-xl text-xs leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-[#0B192C] text-white ml-6'
                          : 'bg-[#FAF9F6] border border-slate-200 text-slate-800 mr-2'
                      }`}
                    >
                      {msg.sender === 'bot' && (
                        <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider text-[#1E40AF] mb-1">
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-[#C5A059]" />
                            <span>Vision Care Optical AI</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveTab('compose')}
                            className="text-[10px] font-medium text-slate-500 hover:text-[#1E40AF] underline cursor-pointer normal-case"
                          >
                            Ask Optometrist →
                          </button>
                        </div>
                      )}
                      <p className="whitespace-pre-line">{msg.text}</p>
                    </div>
                  ))}
                  {isAiThinking && (
                    <div className="p-3 rounded-xl bg-[#FAF9F6] border border-slate-200 text-xs text-slate-500 mr-2 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-[#C5A059] animate-pulse shrink-0" />
                      <span>Checking Vision Care optical catalog & lens guide...</span>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Custom Question Input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAskAiQuestion(aiInput);
                  }}
                  className="flex items-center gap-2 pt-2 border-t border-slate-200"
                >
                  <input
                    type="text"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder="Ask about Rx upload, lenses, or frames..."
                    className="flex-1 min-w-0 border border-slate-300 focus:border-[#1E40AF] focus:outline-none rounded-lg px-2.5 py-2 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={isAiThinking || !aiInput.trim()}
                    className="px-3 py-2 bg-[#0B192C] hover:bg-[#162B49] disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Send className="w-3.5 h-3.5 text-[#C5A059]" />
                    <span className="hidden sm:inline">Ask</span>
                  </button>
                </form>
              </div>
            ) : activeTab === 'compose' ? (
              <form onSubmit={handleSubmit} className="space-y-3">
                {successBanner && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium">{successBanner}</p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('history')}
                        className="text-[11px] font-semibold text-emerald-800 underline mt-1 cursor-pointer"
                      >
                        View in My Enquiries →
                      </button>
                    </div>
                  </div>
                )}

                {errorMsg && (
                  <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                    {errorMsg}
                  </div>
                )}

                {/* Quick Topic Selector */}
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    Select Enquiry Topic
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_TOPICS.map((topic) => {
                      const selected = subject === topic;
                      return (
                        <button
                          key={topic}
                          type="button"
                          onClick={() => setSubject(topic)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                            selected
                              ? 'bg-[#1E40AF] text-white border-[#1E40AF]'
                              : 'bg-[#FAF9F6] text-slate-700 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {topic}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Your Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Full Name"
                      className="w-full border border-slate-300 focus:border-[#1E40AF] focus:outline-none rounded-lg px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="you@domain.com"
                      className="w-full border border-slate-300 focus:border-[#1E40AF] focus:outline-none rounded-lg px-2.5 py-1.5 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Subject *
                    </label>
                    <input
                      type="text"
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="How can we help?"
                      className="w-full border border-slate-300 focus:border-[#1E40AF] focus:outline-none rounded-lg px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Order # (Optional)
                    </label>
                    {orders.length > 0 ? (
                      <select
                        value={orderNumber}
                        onChange={(e) => setOrderNumber(e.target.value)}
                        className="w-full border border-slate-300 focus:border-[#1E40AF] focus:outline-none rounded-lg px-2.5 py-1.5 text-xs bg-white font-tabular"
                      >
                        <option value="">General Enquiry</option>
                        {orders.map((o) => (
                          <option key={o.id} value={o.orderNumber}>
                            {o.orderNumber} ({o.orderStatus})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={orderNumber}
                        onChange={(e) => setOrderNumber(e.target.value)}
                        placeholder="e.g. VC-849201"
                        className="w-full border border-slate-300 focus:border-[#1E40AF] focus:outline-none rounded-lg px-2.5 py-1.5 text-xs font-tabular"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Message to Admin / Optometrist *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ask about prescription lenses, Varilux progressives, frame sizing, or an active order..."
                    className="w-full border border-slate-300 focus:border-[#1E40AF] focus:outline-none rounded-lg px-3 py-2 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSending}
                  className="w-full py-2.5 px-4 bg-[#0B192C] hover:bg-[#162B49] disabled:opacity-60 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span>{isSending ? 'Sending to Admin...' : 'Send Message to Admin'}</span>
                </button>
              </form>
            ) : (
              /* History & Admin Replies Tab */
              <div className="space-y-3">
                {combinedEnquiries.length === 0 ? (
                  <div className="text-center py-8 space-y-2">
                    <Sparkles className="w-7 h-7 text-[#C5A059] mx-auto" />
                    <p className="text-xs font-semibold text-[#0B192C]">No Support Messages Yet</p>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                      Send a message in the Compose tab and our Admin & Optical Concierge team will respond here.
                    </p>
                  </div>
                ) : (
                  combinedEnquiries.map((enq) => (
                    <div
                      key={enq.id}
                      className="rounded-xl border border-slate-200 bg-[#FAF9F6] p-3 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#0B192C] truncate">{enq.subject}</span>
                        <span
                          className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded shrink-0 ${
                            enq.adminReply
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {enq.adminReply ? 'Replied' : enq.status || 'Open'}
                        </span>
                      </div>

                      {enq.orderNumber && (
                        <div className="text-[10px] font-tabular text-[#1E40AF] font-medium">
                          Order Ref: {enq.orderNumber}
                        </div>
                      )}

                      <p className="text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200/80">
                        {enq.message}
                      </p>

                      {enq.adminReply ? (
                        <div className="p-2.5 rounded-lg bg-[#0B192C] text-white space-y-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#C5A059] block">
                            Official Admin / Optometrist Reply
                          </span>
                          <p className="text-xs text-slate-100 leading-relaxed">{enq.adminReply}</p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Logged in Admin Enquiry System — awaiting concierge reply</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Launcher Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="group flex items-center gap-2.5 px-4 py-3 rounded-full bg-[#0B192C] hover:bg-[#162B49] text-white shadow-xl border border-[#C5A059]/40 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
        aria-label="Toggle Live Support Widget"
      >
        <div className="relative flex items-center justify-center">
          {isOpen ? (
            <X className="w-5 h-5 text-[#C5A059]" />
          ) : (
            <>
              <MessageCircle className="w-5 h-5 text-[#C5A059]" />
              <span className="w-2 h-2 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5" />
            </>
          )}
        </div>
        <span className="text-xs sm:text-sm font-semibold tracking-wide">
          {isOpen ? 'Close Support' : 'Live Support'}
        </span>
        {!isOpen && repliedCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-[#C5A059] text-[#0B192C] text-[10px] font-bold">
            {repliedCount}
          </span>
        )}
      </button>
    </div>
  );
};
