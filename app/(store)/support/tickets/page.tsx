'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface Ticket {
  id: string;
  ticket_number: number;
  email: string;
  subject: string;
  description: string | null;
  category: string | null;
  status: string | null;
  created_at: string;
  updated_at: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  order: 'Order Issue',
  delivery: 'Delivery Problem',
  return: 'Damaged or Wrong Item',
  payment: 'Mobile Money Payment',
  product: 'Fragrance Question',
  wholesale: 'Wholesale Enquiry',
  account: 'Account Help',
  other: 'Other',
};

const FILTERS = [
  { id: 'all', label: 'All Tickets' },
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'resolved', label: 'Resolved' },
];

// Group statuses so the filter tabs cover every ticket_status value.
const statusGroup = (status: string | null) => {
  switch (status) {
    case 'in_progress':
    case 'waiting_customer':
      return 'in_progress';
    case 'resolved':
    case 'closed':
      return 'resolved';
    default:
      return 'open';
  }
};

const statusLabel = (status: string | null) => {
  switch (status) {
    case 'in_progress': return 'In Progress';
    case 'waiting_customer': return 'Awaiting Your Reply';
    case 'resolved': return 'Resolved';
    case 'closed': return 'Closed';
    default: return 'Open';
  }
};

const getStatusColor = (status: string | null) => {
  switch (statusGroup(status)) {
    case 'in_progress': return 'bg-[#F3E2BE] text-[#6B4A0E]';
    case 'resolved': return 'bg-[#DDE7D6] text-[#244A2C]';
    default: return 'bg-[#E8C5BE] text-[#4A1520]';
  }
};

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

export default function MyTicketsPage() {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (!session?.user) {
        setLoading(false);
        return;
      }
      setSignedIn(true);
      const { data, error: loadError } = await supabase
        .from('support_tickets')
        .select('id, ticket_number, email, subject, description, category, status, created_at, updated_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      if (!active) return;
      if (loadError) setError('We could not load your tickets. Please refresh and try again.');
      else setTickets((data as Ticket[]) || []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const countFor = (id: string) =>
    id === 'all' ? tickets.length : tickets.filter((t) => statusGroup(t.status) === id).length;

  const filteredTickets = selectedFilter === 'all'
    ? tickets
    : tickets.filter((ticket) => statusGroup(ticket.status) === selectedFilter);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F1E8DC] flex items-center justify-center">
        <i className="ri-loader-4-line animate-spin motion-reduce:animate-none text-4xl text-[#7A1F2E]"></i>
      </main>
    );
  }

  if (!signedIn) {
    return (
      <main className="min-h-screen bg-[#F1E8DC] text-[#1F1115] py-12 md:py-16">
        <div className="max-w-md mx-auto px-5 text-center">
          <div className="rounded-[24px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] p-8">
            <div className="w-14 h-14 flex items-center justify-center bg-[#2B0B12] rounded-full mx-auto mb-4">
              <i className="ri-ticket-line text-2xl text-[#E5B65A]"></i>
            </div>
            <h1 className="font-serif text-[26px] md:text-[30px] leading-tight mb-2">Sign in to see your tickets</h1>
            <p className="text-[15px] text-[#6B565B] mb-6">Your support tickets are saved to your House of Elle account.</p>
            <div className="space-y-3">
              <Link
                href="/auth/login?redirect=/support/tickets"
                className="flex w-full inline-flex items-center justify-center min-h-[52px] px-7 rounded-full bg-[#2B0B12] text-[#F6EDE3] font-semibold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none"
              >
                Sign In
              </Link>
              <Link href="/support/ticket" className="flex items-center justify-center min-h-[44px] text-[#7A1F2E] font-semibold underline underline-offset-4">
                Send a request without an account
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F1E8DC] text-[#1F1115] py-12 md:py-16">
      <div className="max-w-[960px] mx-auto px-5 sm:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-serif text-[36px] md:text-[48px] leading-[0.95] tracking-[-0.02em] mb-2">My Support Tickets</h1>
            <p className="text-[15px] text-[#6B565B]">Track your support requests</p>
          </div>
          <Link
            href="/support/ticket"
            className="inline-flex items-center justify-center min-h-[52px] px-7 rounded-full bg-[#2B0B12] text-[#F6EDE3] font-semibold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none whitespace-nowrap"
          >
            <i className="ri-add-line mr-2"></i>
            New Ticket
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl bg-[#F6DCD7] text-[#7A1F2E] px-4 py-3 text-sm">{error}</div>
        )}

        <div className="mb-6">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setSelectedFilter(filter.id)}
                aria-pressed={selectedFilter === filter.id}
                className={`shrink-0 min-h-[44px] px-4 rounded-full text-sm font-semibold whitespace-nowrap transition-colors motion-reduce:transition-none ${
                  selectedFilter === filter.id
                    ? 'bg-[#2B0B12] text-[#F6EDE3]'
                    : 'shadow-[inset_0_0_0_1px_rgba(31,17,21,0.2)] hover:bg-[#FBF6EF]'
                }`}
              >
                {filter.label} ({countFor(filter.id)})
              </button>
            ))}
          </div>
        </div>

        {filteredTickets.length === 0 ? (
          <div className="rounded-[24px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] p-8 md:p-12 text-center">
            <div className="w-14 h-14 flex items-center justify-center bg-[#F1E8DC] rounded-full mx-auto mb-6">
              <i className="ri-ticket-line text-2xl text-[#7A1F2E]"></i>
            </div>
            <h2 className="font-serif text-[26px] md:text-[30px] leading-tight mb-2">No tickets found</h2>
            <p className="text-[15px] text-[#6B565B] mb-6">
              {tickets.length === 0 ? "You don't have any support tickets yet." : 'No tickets match this filter.'}
            </p>
            {tickets.length === 0 && (
              <Link
                href="/support/ticket"
                className="inline-flex items-center justify-center min-h-[52px] px-7 rounded-full bg-[#2B0B12] text-[#F6EDE3] font-semibold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none whitespace-nowrap"
              >
                Create Your First Ticket
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredTickets.map((ticket) => {
              const expanded = expandedId === ticket.id;
              return (
                <div
                  key={ticket.id}
                  className={`rounded-[22px] bg-[#FBF6EF] transition-shadow motion-reduce:transition-none ${expanded ? 'shadow-[inset_0_0_0_1.5px_#2B0B12]' : 'shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)]'}`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : ticket.id)}
                    aria-expanded={expanded}
                    className="w-full text-left p-5 sm:p-6 min-h-[44px]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <h3 className="font-serif text-[20px] sm:text-[22px] leading-tight break-words">{ticket.subject}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${getStatusColor(ticket.status)}`}>
                            {statusLabel(ticket.status)}
                          </span>
                        </div>
                        <p className="text-[15px] text-[#6B565B] mb-3">
                          {(ticket.category && CATEGORY_LABELS[ticket.category]) || ticket.category || 'General'} • Ticket #{ticket.ticket_number}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-[#6B565B]">
                          <span className="flex items-center gap-2">
                            <i className="ri-calendar-line"></i>
                            Created {formatDate(ticket.created_at)}
                          </span>
                          {ticket.updated_at && ticket.updated_at !== ticket.created_at && (
                            <span className="flex items-center gap-2">
                              <i className="ri-time-line"></i>
                              Updated {formatDate(ticket.updated_at)}
                            </span>
                          )}
                        </div>
                      </div>
                      <i className={`ri-arrow-down-s-line text-2xl text-[#7A1F2E] transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}></i>
                    </div>
                  </button>
                  {expanded && (
                    <div className="px-6 pb-6 border-t border-[#1F1115]/10 pt-4">
                      <p className="text-[13px] font-semibold mb-1.5">Your message</p>
                      <p className="text-[15px] leading-relaxed text-[#4D3A3F] whitespace-pre-line break-words">
                        {ticket.description || 'No description provided.'}
                      </p>
                      <p className="text-sm text-[#6B565B] mt-4">
                        We reply by email to {ticket.email}.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
