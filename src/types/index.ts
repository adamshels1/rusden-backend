export interface Channel {
  id: string;
  telegram_id: string;
  username: string;
  title: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RawMessage {
  id: string;
  channel_id: string;
  telegram_message_id: number;
  raw_text: string;
  author_telegram_id: string | null;
  author_username: string | null;
  author_first_name: string | null;
  author_last_name: string | null;
  author_phone: string | null;
  images: string[] | null;
  has_buttons: boolean;
  posted_at: string;
  parsed_at: string;
  created_at: string;
}

export interface Listing {
  id: string;
  raw_message_id: string;
  category: 'realty' | 'job' | 'service' | 'goods' | 'event';
  subcategory: string | null;
  title: string | null;
  description: string | null;
  price_amount: number | null;
  price_currency: 'EUR' | 'USD' | 'TRY' | null;
  price_period: 'month' | 'day' | 'once' | null;
  city: string | null;
  district: string | null;
  contact_phone: string | null;
  contact_telegram: string | null;
  contact_other: string | null;
  realty_rooms: string | null;
  realty_area_sqm: number | null;
  realty_floor: number | null;
  realty_distance_to_sea: number | null;
  language: 'ru' | 'en' | 'tr' | null;
  is_spam: boolean;
  is_duplicate: boolean;
  duplicate_of: string | null;
  ai_confidence: number | null;
  ai_processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  ai_error_message: string | null;
  created_at: string;
  updated_at: string;
}

// Входные данные от telegram-parser
export interface TelegramMessage {
  id: number;
  date: string;
  text: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    username: string | null;
    phone: string | null;
  };
  images: string[];
  hasButtons: boolean;
}
