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
    case 'in_progress': return 'bg-amber-100 text-amber-700';
    case 'resolved': return 'bg-green-100 text-green-700';
    default: return 'bg-blue-100 text-blue-700';
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
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <i className="ri-loader-4-line animate-spin text-4xl text-blue-700"></i>
      </main>
    );
  }

  if (!signedIn) {
    return (
      <main className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-md mx-auto px-4 text-center">
          <div className="bg-white rounded-xl shadow-sm p-8">
            <div className="w-16 h-16 flex items-center justify-center bg-blue-100 rounded-full mx-auto mb-4">
              <i className="ri-ticket-line text-3xl text-blue-700"></i>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Sign in to see your tickets</h1>
            <p className="text-gray-600 mb-6">Your support tickets are saved to your House of Elle account.</p>
            <div className="space-y-3">
              <Link
                href="/auth/login?redirect=/support/tickets"
                className="block bg-blue-700 hover:bg-blue-800 text-white py-3 rounded-lg font-semibold transition-colors"
              >
                Sign In
              </Link>
              <Link href="/support/ticket" className="block text-blue-700 hover:text-blue-900 font-semibold">
                Send a request without an account
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">My Support Tickets</h1>
            <p className="text-gray-600">Track your support requests</p>
          </div>
          <Link
            href="/support/ticket"
            className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap text-center"
          >
            <i className="ri-add-line mr-2"></i>
            New Ticket
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setSelectedFilter(filter.id)}
                className={`px-6 py-4 font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  selectedFilter === filter.id
                    ? 'border-blue-700 text-blue-700'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {filter.label} ({countFor(filter.id)})
              </button>
            ))}
          </div>
        </div>

        {filteredTickets.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="w-20 h-20 flex items-center justify-center bg-gray-100 rounded-full mx-auto mb-6">
              <i className="ri-ticket-line text-4xl text-gray-400"></i>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No tickets found</h2>
            <p className="text-gray-600 mb-6">
              {tickets.length === 0 ? "You don't have any support tickets yet." : 'No tickets match this filter.'}
            </p>
            {tickets.length === 0 && (
              <Link
                href="/support/ticket"
                className="inline-block bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap"
              >
                Create Your First Ticket
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTickets.map((ticket) => {
              const expanded = expandedId === ticket.id;
              return (
                <div
                  key={ticket.id}
                  className={`bg-white rounded-xl shadow-sm border-2 transition-colors ${expanded ? 'border-blue-700' : 'border-transparent'}`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : ticket.id)}
                    aria-expanded={expanded}
                    className="w-full text-left p-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <h3 className="text-lg sm:text-xl font-bold text-gray-900 break-words">{ticket.subject}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${getStatusColor(ticket.status)}`}>
                            {statusLabel(ticket.status)}
                          </span>
                        </div>
                        <p className="text-gray-600 mb-3">
                          {(ticket.category && CATEGORY_LABELS[ticket.category]) || ticket.category || 'General'} • Ticket #{ticket.ticket_number}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-gray-500">
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
                      <i className={`ri-arrow-down-s-line text-2xl text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}></i>
                    </div>
                  </button>
                  {expanded && (
                    <div className="px-6 pb-6 border-t border-gray-100 pt-4">
                      <p className="text-sm font-semibold text-gray-900 mb-2">Your message</p>
                      <p className="text-gray-700 whitespace-pre-line break-words">
                        {ticket.description || 'No description provided.'}
                      </p>
                      <p className="text-sm text-gray-500 mt-4">
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
