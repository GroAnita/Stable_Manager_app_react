export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      card_agreements: {
        Row: {
          accepted_at: string
          accepted_by: string | null
          accepted_by_name: string
          activated_at: string | null
          agreement_text: string
          card_brand: string | null
          card_last4: string | null
          charge_day: number
          contract_id: string
          copy_sent_at: string | null
          created_at: string
          id: string
          owner_id: string
          paused_at: string | null
          paused_by: string | null
          pending_card_session_id: string | null
          stable_id: string
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_payment_method_id: string | null
          updated_at: string
          version: string
          withdrawn_at: string | null
          withdrawn_by: string | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
      announcement_acknowledgments: {
        Row: {
          announcement_id: string
          created_at: string
          id: string
          stable_id: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          created_at?: string
          id?: string
          stable_id: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          created_at?: string
          id?: string
          stable_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_acknowledgments_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_acknowledgments_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_acknowledgments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_comments: {
        Row: {
          announcement_id: string
          author_id: string
          body: string
          created_at: string
          id: string
          stable_id: string
        }
        Insert: {
          announcement_id: string
          author_id: string
          body: string
          created_at?: string
          id?: string
          stable_id: string
        }
        Update: {
          announcement_id?: string
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          stable_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_comments_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_comments_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string
          category: string
          created_at: string
          created_by: string
          id: string
          stable_id: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          created_by: string
          id?: string
          stable_id: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          created_by?: string
          id?: string
          stable_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_dates: {
        Row: {
          created_at: string
          date: string
          id: string
          label: string | null
          stable_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          label?: string | null
          stable_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          label?: string | null
          stable_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_dates_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          created_at: string
          custom_type: string | null
          description: string | null
          end_time: string | null
          event_type: Database["public"]["Enums"]["calendar_event_type"]
          horse_id: string | null
          id: string
          owner_id: string | null
          stable_id: string
          start_time: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_type?: string | null
          description?: string | null
          end_time?: string | null
          event_type: Database["public"]["Enums"]["calendar_event_type"]
          horse_id?: string | null
          id?: string
          owner_id?: string | null
          stable_id: string
          start_time: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_type?: string | null
          description?: string | null
          end_time?: string | null
          event_type?: Database["public"]["Enums"]["calendar_event_type"]
          horse_id?: string | null
          id?: string
          owner_id?: string | null
          stable_id?: string
          start_time?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      co_rider_agreements: {
        Row: {
          billing_frequency:
            | Database["public"]["Enums"]["co_rider_billing_frequency"]
            | null
          co_rider_id: string
          created_at: string
          end_date: string | null
          fee_amount: number | null
          horse_id: string
          id: string
          notes: string | null
          stable_duties: string | null
          stable_id: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          billing_frequency?:
            | Database["public"]["Enums"]["co_rider_billing_frequency"]
            | null
          co_rider_id: string
          created_at?: string
          end_date?: string | null
          fee_amount?: number | null
          horse_id: string
          id?: string
          notes?: string | null
          stable_duties?: string | null
          stable_id: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          billing_frequency?:
            | Database["public"]["Enums"]["co_rider_billing_frequency"]
            | null
          co_rider_id?: string
          created_at?: string
          end_date?: string | null
          fee_amount?: number | null
          horse_id?: string
          id?: string
          notes?: string | null
          stable_duties?: string | null
          stable_id?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "co_rider_agreements_co_rider_id_fkey"
            columns: ["co_rider_id"]
            isOneToOne: false
            referencedRelation: "co_riders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "co_rider_agreements_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "co_rider_agreements_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      co_riders: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          stable_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          stable_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          stable_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "co_riders_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          additional_services: string | null
          bedding_price_list_item_id: string | null
          bedding_quantity: number
          card_agreement_accepted_at: string | null
          charge_day: number | null
          boarding_price_list_item_id: string | null
          contract_terms: string | null
          created_at: string
          deposit: number | null
          end_date: string | null
          hay_price_list_item_id: string | null
          horse_id: string
          id: string
          included_hay_kg: number | null
          included_services: string | null
          monthly_rent: number
          notes: string | null
          owner_id: string
          stable_id: string
          stall_id: string | null
          turnout_shelter_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["contract_status"]
          updated_at: string
        }
        Insert: {
          additional_services?: string | null
          bedding_price_list_item_id?: string | null
          bedding_quantity?: number
          card_agreement_accepted_at?: string | null
          charge_day?: number | null
          boarding_price_list_item_id?: string | null
          contract_terms?: string | null
          created_at?: string
          deposit?: number | null
          end_date?: string | null
          hay_price_list_item_id?: string | null
          horse_id: string
          id?: string
          included_hay_kg?: number | null
          included_services?: string | null
          monthly_rent?: number
          notes?: string | null
          owner_id: string
          stable_id: string
          stall_id?: string | null
          turnout_shelter_id?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["contract_status"]
          updated_at?: string
        }
        Update: {
          additional_services?: string | null
          bedding_price_list_item_id?: string | null
          bedding_quantity?: number
          card_agreement_accepted_at?: string | null
          charge_day?: number | null
          boarding_price_list_item_id?: string | null
          contract_terms?: string | null
          created_at?: string
          deposit?: number | null
          end_date?: string | null
          hay_price_list_item_id?: string | null
          horse_id?: string
          id?: string
          included_hay_kg?: number | null
          included_services?: string | null
          monthly_rent?: number
          notes?: string | null
          owner_id?: string
          stable_id?: string
          stall_id?: string | null
          turnout_shelter_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["contract_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_bedding_price_list_item_id_fkey"
            columns: ["bedding_price_list_item_id"]
            isOneToOne: false
            referencedRelation: "price_list_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_boarding_price_list_item_id_fkey"
            columns: ["boarding_price_list_item_id"]
            isOneToOne: false
            referencedRelation: "price_list_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_hay_price_list_item_id_fkey"
            columns: ["hay_price_list_item_id"]
            isOneToOne: false
            referencedRelation: "price_list_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_stall_id_fkey"
            columns: ["stall_id"]
            isOneToOne: false
            referencedRelation: "stalls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_turnout_shelter_id_fkey"
            columns: ["turnout_shelter_id"]
            isOneToOne: false
            referencedRelation: "turnout_shelters"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          booking_mode: Database["public"]["Enums"]["course_booking_mode"]
          capacity: number
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          instructor_name: string | null
          level: string | null
          location: string | null
          price: number | null
          spare_release_days_before: number
          stable_id: string
          start_time: string
          status: Database["public"]["Enums"]["course_status"]
          term_end_date: string
          term_start_date: string
          title: string
          updated_at: string
          weekday: number
        }
        Insert: {
          booking_mode?: Database["public"]["Enums"]["course_booking_mode"]
          capacity?: number
          created_at?: string
          created_by?: string | null
          end_time: string
          id?: string
          instructor_name?: string | null
          level?: string | null
          location?: string | null
          price?: number | null
          spare_release_days_before?: number
          stable_id: string
          start_time: string
          status?: Database["public"]["Enums"]["course_status"]
          term_end_date: string
          term_start_date: string
          title: string
          updated_at?: string
          weekday: number
        }
        Update: {
          booking_mode?: Database["public"]["Enums"]["course_booking_mode"]
          capacity?: number
          created_at?: string
          created_by?: string | null
          end_time?: string
          id?: string
          instructor_name?: string | null
          level?: string | null
          location?: string | null
          price?: number | null
          spare_release_days_before?: number
          stable_id?: string
          start_time?: string
          status?: Database["public"]["Enums"]["course_status"]
          term_end_date?: string
          term_start_date?: string
          title?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          contract_id: string | null
          created_at: string
          document_type: Database["public"]["Enums"]["document_type"]
          file_url: string
          horse_id: string | null
          id: string
          owner_id: string | null
          stable_id: string
          uploaded_at: string
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          document_type: Database["public"]["Enums"]["document_type"]
          file_url: string
          horse_id?: string | null
          id?: string
          owner_id?: string | null
          stable_id: string
          uploaded_at?: string
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          document_type?: Database["public"]["Enums"]["document_type"]
          file_url?: string
          horse_id?: string | null
          id?: string
          owner_id?: string | null
          stable_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      enrolments: {
        Row: {
          course_id: string
          enrolled_at: string
          id: string
          rider_id: string | null
          status: string
          withdrawn_at: string | null
        }
        Insert: {
          course_id: string
          enrolled_at?: string
          id?: string
          rider_id?: string | null
          status?: string
          withdrawn_at?: string | null
        }
        Update: {
          course_id?: string
          enrolled_at?: string
          id?: string
          rider_id?: string | null
          status?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrolments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrolments_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          expense_date: string
          id: string
          notes: string | null
          stable_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          expense_date: string
          id?: string
          notes?: string | null
          stable_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          expense_date?: string
          id?: string
          notes?: string | null
          stable_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      feeding_plans: {
        Row: {
          created_at: string
          evening_feed: string | null
          evening_hay: string | null
          evening_supplements: string | null
          extras: string | null
          horse_id: string
          id: string
          lunch: string | null
          lunch_feed: string | null
          lunch_hay: string | null
          lunch_supplements: string | null
          morning_feed: string | null
          morning_hay: string | null
          morning_supplements: string | null
          special_instructions: string | null
          stable_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          evening_feed?: string | null
          evening_hay?: string | null
          evening_supplements?: string | null
          extras?: string | null
          horse_id: string
          id?: string
          lunch?: string | null
          lunch_feed?: string | null
          lunch_hay?: string | null
          lunch_supplements?: string | null
          morning_feed?: string | null
          morning_hay?: string | null
          morning_supplements?: string | null
          special_instructions?: string | null
          stable_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          evening_feed?: string | null
          evening_hay?: string | null
          evening_supplements?: string | null
          extras?: string | null
          horse_id?: string
          id?: string
          lunch?: string | null
          lunch_feed?: string | null
          lunch_hay?: string | null
          lunch_supplements?: string | null
          morning_feed?: string | null
          morning_hay?: string | null
          morning_supplements?: string | null
          special_instructions?: string | null
          stable_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feeding_plans_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: true
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeding_plans_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      feeding_rota_participants: {
        Row: {
          active: boolean
          created_at: string
          id: string
          owner_id: string
          stable_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          owner_id: string
          stable_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          owner_id?: string
          stable_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feeding_rota_participants_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeding_rota_participants_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      feeding_shift_swap_requests: {
        Row: {
          created_at: string
          id: string
          requested_by_owner_id: string
          requested_to_owner_id: string
          responded_at: string | null
          shift_id: string
          stable_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          requested_by_owner_id: string
          requested_to_owner_id: string
          responded_at?: string | null
          shift_id: string
          stable_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          requested_by_owner_id?: string
          requested_to_owner_id?: string
          responded_at?: string | null
          shift_id?: string
          stable_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "feeding_shift_swap_requests_requested_by_owner_id_fkey"
            columns: ["requested_by_owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeding_shift_swap_requests_requested_to_owner_id_fkey"
            columns: ["requested_to_owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeding_shift_swap_requests_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "feeding_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeding_shift_swap_requests_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      feeding_shift_type_horses: {
        Row: {
          horse_id: string
          shift_type_id: string
        }
        Insert: {
          horse_id: string
          shift_type_id: string
        }
        Update: {
          horse_id?: string
          shift_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feeding_shift_type_horses_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeding_shift_type_horses_shift_type_id_fkey"
            columns: ["shift_type_id"]
            isOneToOne: false
            referencedRelation: "feeding_shift_types"
            referencedColumns: ["id"]
          },
        ]
      }
      feeding_shift_types: {
        Row: {
          active: boolean
          created_at: string
          id: string
          label: string
          scope: string
          sort_order: number
          stable_id: string
          time_of_day: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          label: string
          scope?: string
          sort_order?: number
          stable_id: string
          time_of_day: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          label?: string
          scope?: string
          sort_order?: number
          stable_id?: string
          time_of_day?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feeding_shift_types_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      feeding_shifts: {
        Row: {
          assigned_owner_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          date: string
          id: string
          let_in_at: string | null
          let_in_by: string | null
          let_out_at: string | null
          let_out_by: string | null
          reminder_day_before_sent_at: string | null
          reminder_hour_before_sent_at: string | null
          shift_type_id: string
          stable_id: string
          status: string
          unassignable: boolean
          updated_at: string
        }
        Insert: {
          assigned_owner_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          let_in_at?: string | null
          let_in_by?: string | null
          let_out_at?: string | null
          let_out_by?: string | null
          reminder_day_before_sent_at?: string | null
          reminder_hour_before_sent_at?: string | null
          shift_type_id: string
          stable_id: string
          status?: string
          unassignable?: boolean
          updated_at?: string
        }
        Update: {
          assigned_owner_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          let_in_at?: string | null
          let_in_by?: string | null
          let_out_at?: string | null
          let_out_by?: string | null
          reminder_day_before_sent_at?: string | null
          reminder_hour_before_sent_at?: string | null
          shift_type_id?: string
          stable_id?: string
          status?: string
          unassignable?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feeding_shifts_assigned_owner_id_fkey"
            columns: ["assigned_owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeding_shifts_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeding_shifts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeding_shifts_let_in_by_fkey"
            columns: ["let_in_by"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeding_shifts_let_out_by_fkey"
            columns: ["let_out_by"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeding_shifts_shift_type_id_fkey"
            columns: ["shift_type_id"]
            isOneToOne: false
            referencedRelation: "feeding_shift_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeding_shifts_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      feeding_times: {
        Row: {
          created_at: string
          feed: string | null
          feeding_shift_type_id: string | null
          hay: string | null
          horse_id: string
          id: string
          label: string
          stable_id: string
          supplements: string | null
          time_of_day: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          feed?: string | null
          feeding_shift_type_id?: string | null
          hay?: string | null
          horse_id: string
          id?: string
          label: string
          stable_id: string
          supplements?: string | null
          time_of_day?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          feed?: string | null
          feeding_shift_type_id?: string | null
          hay?: string | null
          horse_id?: string
          id?: string
          label?: string
          stable_id?: string
          supplements?: string | null
          time_of_day?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feeding_times_feeding_shift_type_id_fkey"
            columns: ["feeding_shift_type_id"]
            isOneToOne: false
            referencedRelation: "feeding_shift_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeding_times_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeding_times_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      fire_safety_checks: {
        Row: {
          check_type: string
          created_at: string
          id: string
          last_checked_date: string
          notes: string | null
          stable_id: string
          updated_at: string
        }
        Insert: {
          check_type: string
          created_at?: string
          id?: string
          last_checked_date: string
          notes?: string | null
          stable_id: string
          updated_at?: string
        }
        Update: {
          check_type?: string
          created_at?: string
          id?: string
          last_checked_date?: string
          notes?: string | null
          stable_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fire_safety_checks_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      horse_additional_owners: {
        Row: {
          created_at: string
          horse_id: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          horse_id: string
          owner_id: string
        }
        Update: {
          created_at?: string
          horse_id?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "horse_additional_owners_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horse_additional_owners_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      horses: {
        Row: {
          active: boolean
          age: number | null
          allergies: string | null
          arrival_date: string | null
          away: boolean
          back_hoof_size: string | null
          birthday: string | null
          breed: string | null
          color: string | null
          created_at: string
          extras: string | null
          feeding_notes: string | null
          front_hoof_size: string | null
          gender: string | null
          id: string
          insurance_company: string | null
          insurance_number: string | null
          is_school_horse: boolean
          medical_notes: string | null
          microchip_number: string | null
          name: string
          notes: string | null
          owner_id: string | null
          paddock_id: string | null
          passport_number: string | null
          photo_url: string | null
          stable_id: string
          stall_id: string | null
          status: string
          turnout_shelter_id: string | null
          updated_at: string
          vaccination_status: string | null
        }
        Insert: {
          active?: boolean
          age?: number | null
          allergies?: string | null
          arrival_date?: string | null
          away?: boolean
          back_hoof_size?: string | null
          birthday?: string | null
          breed?: string | null
          color?: string | null
          created_at?: string
          extras?: string | null
          feeding_notes?: string | null
          front_hoof_size?: string | null
          gender?: string | null
          id?: string
          insurance_company?: string | null
          insurance_number?: string | null
          is_school_horse?: boolean
          medical_notes?: string | null
          microchip_number?: string | null
          name: string
          notes?: string | null
          owner_id?: string | null
          paddock_id?: string | null
          passport_number?: string | null
          photo_url?: string | null
          stable_id: string
          stall_id?: string | null
          status?: string
          turnout_shelter_id?: string | null
          updated_at?: string
          vaccination_status?: string | null
        }
        Update: {
          active?: boolean
          age?: number | null
          allergies?: string | null
          arrival_date?: string | null
          away?: boolean
          back_hoof_size?: string | null
          birthday?: string | null
          breed?: string | null
          color?: string | null
          created_at?: string
          extras?: string | null
          feeding_notes?: string | null
          front_hoof_size?: string | null
          gender?: string | null
          id?: string
          insurance_company?: string | null
          insurance_number?: string | null
          is_school_horse?: boolean
          medical_notes?: string | null
          microchip_number?: string | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          paddock_id?: string | null
          passport_number?: string | null
          photo_url?: string | null
          stable_id?: string
          stall_id?: string | null
          status?: string
          turnout_shelter_id?: string | null
          updated_at?: string
          vaccination_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "horses_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horses_paddock_id_fkey"
            columns: ["paddock_id"]
            isOneToOne: false
            referencedRelation: "paddocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horses_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horses_stall_id_fkey"
            columns: ["stall_id"]
            isOneToOne: false
            referencedRelation: "stalls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horses_turnout_shelter_id_fkey"
            columns: ["turnout_shelter_id"]
            isOneToOne: false
            referencedRelation: "turnout_shelters"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_deliveries: {
        Row: {
          created_at: string
          delivered_on: string
          id: string
          inventory_item_id: string
          notes: string | null
          quantity: number
          stable_id: string
        }
        Insert: {
          created_at?: string
          delivered_on: string
          id?: string
          inventory_item_id: string
          notes?: string | null
          quantity: number
          stable_id: string
        }
        Update: {
          created_at?: string
          delivered_on?: string
          id?: string
          inventory_item_id?: string
          notes?: string | null
          quantity?: number
          stable_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_deliveries_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_deliveries_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          created_at: string
          id: string
          low_stock_days_threshold: number
          notes: string | null
          price_list_item_id: string
          stable_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          low_stock_days_threshold?: number
          notes?: string | null
          price_list_item_id: string
          stable_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          low_stock_days_threshold?: number
          notes?: string | null
          price_list_item_id?: string
          stable_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_price_list_item_id_fkey"
            columns: ["price_list_item_id"]
            isOneToOne: false
            referencedRelation: "price_list_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_bookings: {
        Row: {
          cancelled_at: string | null
          created_at: string
          enrolment_id: string | null
          horse_id: string | null
          id: string
          owner_id: string
          rider_id: string | null
          session_id: string
          status: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          enrolment_id?: string | null
          horse_id?: string | null
          id?: string
          owner_id: string
          rider_id?: string | null
          session_id: string
          status?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          enrolment_id?: string | null
          horse_id?: string | null
          id?: string
          owner_id?: string
          rider_id?: string | null
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_bookings_enrolment_id_fkey"
            columns: ["enrolment_id"]
            isOneToOne: false
            referencedRelation: "enrolments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_bookings_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_bookings_lesson_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "lesson_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_bookings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_bookings_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_sessions: {
        Row: {
          capacity: number
          course_id: string | null
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          instructor_name: string | null
          notes: string | null
          stable_id: string
          starts_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          capacity?: number
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          instructor_name?: string | null
          notes?: string | null
          stable_id: string
          starts_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          instructor_name?: string | null
          notes?: string | null
          stable_id?: string
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_records: {
        Row: {
          created_at: string
          date: string
          description: string | null
          document_url: string | null
          horse_id: string
          id: string
          medication: string | null
          next_due: string | null
          stable_id: string
          type: string | null
          updated_at: string
          veterinarian: string | null
        }
        Insert: {
          created_at?: string
          date?: string
          description?: string | null
          document_url?: string | null
          horse_id: string
          id?: string
          medication?: string | null
          next_due?: string | null
          stable_id: string
          type?: string | null
          updated_at?: string
          veterinarian?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          description?: string | null
          document_url?: string | null
          horse_id?: string
          id?: string
          medication?: string | null
          next_due?: string | null
          stable_id?: string
          type?: string | null
          updated_at?: string
          veterinarian?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_records_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          horse_id: string | null
          id: string
          is_read: boolean
          message: string | null
          notification_type: Database["public"]["Enums"]["notification_type"]
          owner_id: string | null
          stable_id: string
          title: string
        }
        Insert: {
          created_at?: string
          horse_id?: string | null
          id?: string
          is_read?: boolean
          message?: string | null
          notification_type: Database["public"]["Enums"]["notification_type"]
          owner_id?: string | null
          stable_id: string
          title: string
        }
        Update: {
          created_at?: string
          horse_id?: string | null
          id?: string
          is_read?: boolean
          message?: string | null
          notification_type?: Database["public"]["Enums"]["notification_type"]
          owner_id?: string | null
          stable_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_unavailability: {
        Row: {
          created_at: string
          end_date: string
          id: string
          owner_id: string
          reason: string | null
          stable_id: string
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          owner_id: string
          reason?: string | null
          stable_id: string
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          owner_id?: string
          reason?: string | null
          stable_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_unavailability_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_unavailability_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      owners: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          email: string | null
          emergency_contact: string | null
          emergency_phone: string | null
          full_name: string
          id: string
          notes: string | null
          payment_method: string | null
          phone: string | null
          postal_code: string | null
          stable_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          full_name: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          phone?: string | null
          postal_code?: string | null
          stable_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          phone?: string | null
          postal_code?: string | null
          stable_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owners_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      paddocks: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          size: string | null
          stable_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          size?: string | null
          stable_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          size?: string | null
          stable_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paddocks_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          stripe_fee: number | null
          stripe_net: number | null
          refunded_amount: number
          refunded_at: string | null
          dispute_fee: number | null
          dispute_opened_at: string | null
          dispute_id: string | null
          dispute_status: string | null
          dispute_reason: string | null
          dispute_amount: number | null
          dispute_evidence_due_by: string | null
          dispute_notified_at: string | null
          dispute_lost_at: string | null
          charge_attempts: number
          charge_failure_notified_attempt: number | null
          charge_retry_not_before: string | null
          charge_error: string | null
          charge_started_at: string | null
          charge_status: string | null
          charged_at: string | null
          contract_id: string
          created_at: string
          due_date: string
          id: string
          invoice_email_delivered_at: string | null
          invoice_email_delivery_status: string | null
          invoice_email_error: string | null
          invoice_email_required: boolean
          invoice_email_sent_at: string | null
          invoice_email_sent_to: string | null
          invoice_number: string | null
          notes: string | null
          owner_id: string
          paid_date: string | null
          payment_method: string | null
          stable_id: string
          status: Database["public"]["Enums"]["payment_status"]
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          contract_id: string
          created_at?: string
          due_date: string
          id?: string
          invoice_email_delivered_at?: string | null
          invoice_email_delivery_status?: string | null
          invoice_email_error?: string | null
          invoice_email_required?: boolean
          invoice_email_sent_at?: string | null
          invoice_email_sent_to?: string | null
          invoice_number?: string | null
          notes?: string | null
          owner_id: string
          paid_date?: string | null
          payment_method?: string | null
          stable_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_fee?: number | null
          stripe_net?: number | null
          refunded_amount?: number
          refunded_at?: string | null
          dispute_fee?: number | null
          dispute_opened_at?: string | null
          dispute_id?: string | null
          dispute_status?: string | null
          dispute_reason?: string | null
          dispute_amount?: number | null
          dispute_evidence_due_by?: string | null
          dispute_notified_at?: string | null
          dispute_lost_at?: string | null
          charge_attempts?: number
          charge_failure_notified_attempt?: number | null
          charge_retry_not_before?: string | null
          charge_error?: string | null
          charge_started_at?: string | null
          charge_status?: string | null
          charged_at?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          due_date?: string
          id?: string
          invoice_email_delivered_at?: string | null
          invoice_email_delivery_status?: string | null
          invoice_email_error?: string | null
          invoice_email_required?: boolean
          invoice_email_sent_at?: string | null
          invoice_email_sent_to?: string | null
          invoice_number?: string | null
          notes?: string | null
          owner_id?: string
          paid_date?: string | null
          payment_method?: string | null
          stable_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_fee?: number | null
          stripe_net?: number | null
          refunded_amount?: number
          refunded_at?: string | null
          dispute_fee?: number | null
          dispute_opened_at?: string | null
          dispute_id?: string | null
          dispute_status?: string | null
          dispute_reason?: string | null
          dispute_amount?: number | null
          dispute_evidence_due_by?: string | null
          dispute_notified_at?: string | null
          dispute_lost_at?: string | null
          charge_attempts?: number
          charge_failure_notified_attempt?: number | null
          charge_retry_not_before?: string | null
          charge_error?: string | null
          charge_started_at?: string | null
          charge_status?: string | null
          charged_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list_items: {
        Row: {
          category: string | null
          created_at: string
          id: string
          item: string
          notes: string | null
          price: number
          stable_id: string
          unit: string | null
          updated_at: string
          vat_exempt: boolean
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          item: string
          notes?: string | null
          price?: number
          stable_id: string
          unit?: string | null
          updated_at?: string
          vat_exempt?: boolean
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          item?: string
          notes?: string | null
          price?: number
          stable_id?: string
          unit?: string | null
          updated_at?: string
          vat_exempt?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "price_list_items_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          stable_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          stable_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          stable_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          platform: string
          token: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          platform?: string
          token: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          platform?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      riders: {
        Row: {
          birthday: string | null
          created_at: string
          full_name: string
          id: string
          notes: string | null
          owner_id: string
          updated_at: string
        }
        Insert: {
          birthday?: string | null
          created_at?: string
          full_name: string
          id?: string
          notes?: string | null
          owner_id: string
          updated_at?: string
        }
        Update: {
          birthday?: string | null
          created_at?: string
          full_name?: string
          id?: string
          notes?: string | null
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "riders_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      stable_invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          kind: string
          owner_id: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          stable_id: string
          staff_id: string | null
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          kind: string
          owner_id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          stable_id: string
          staff_id?: string | null
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          kind?: string
          owner_id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          stable_id?: string
          staff_id?: string | null
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stable_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stable_invites_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stable_invites_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stable_invites_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stable_invites_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stable_payment_accounts: {
        Row: {
          addon_enabled: boolean
          card_signing_enabled: boolean
          charge_day: number
          charges_enabled: boolean
          created_at: string
          payouts_enabled: boolean
          stable_id: string
          stripe_account_id: string | null
          updated_at: string
        }
        Insert: {
          addon_enabled?: boolean
          card_signing_enabled?: boolean
          charge_day?: number
          charges_enabled?: boolean
          created_at?: string
          payouts_enabled?: boolean
          stable_id: string
          stripe_account_id?: string | null
          updated_at?: string
        }
        Update: {
          addon_enabled?: boolean
          card_signing_enabled?: boolean
          charge_day?: number
          charges_enabled?: boolean
          created_at?: string
          payouts_enabled?: boolean
          stable_id?: string
          stripe_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stable_payment_accounts_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: true
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      stables: {
        Row: {
          address: string | null
          bank_account_number: string | null
          business_register_registered: boolean
          city: string | null
          created_at: string
          default_contract_terms: string | null
          email: string | null
          enabled_features: Json
          id: string
          invoice_footer_text: string | null
          logo_url: string | null
          name: string
          org_number: string | null
          owner_user_id: string
          payment_terms_days: number
          phone: string | null
          plan: Database["public"]["Enums"]["stable_plan"]
          postal_code: string | null
          stable_type: Database["public"]["Enums"]["stable_type"]
          stripe_customer_id: string | null
          updated_at: string
          vat_registered: boolean
        }
        Insert: {
          address?: string | null
          bank_account_number?: string | null
          business_register_registered?: boolean
          city?: string | null
          created_at?: string
          default_contract_terms?: string | null
          email?: string | null
          enabled_features?: Json
          id?: string
          invoice_footer_text?: string | null
          logo_url?: string | null
          name: string
          org_number?: string | null
          owner_user_id: string
          payment_terms_days?: number
          phone?: string | null
          plan?: Database["public"]["Enums"]["stable_plan"]
          postal_code?: string | null
          stable_type?: Database["public"]["Enums"]["stable_type"]
          stripe_customer_id?: string | null
          updated_at?: string
          vat_registered?: boolean
        }
        Update: {
          address?: string | null
          bank_account_number?: string | null
          business_register_registered?: boolean
          city?: string | null
          created_at?: string
          default_contract_terms?: string | null
          email?: string | null
          enabled_features?: Json
          id?: string
          invoice_footer_text?: string | null
          logo_url?: string | null
          name?: string
          org_number?: string | null
          owner_user_id?: string
          payment_terms_days?: number
          phone?: string | null
          plan?: Database["public"]["Enums"]["stable_plan"]
          postal_code?: string | null
          stable_type?: Database["public"]["Enums"]["stable_type"]
          stripe_customer_id?: string | null
          updated_at?: string
          vat_registered?: boolean
        }
        Relationships: []
      }
      staff: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          stable_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          stable_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          stable_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stalls: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          size: string | null
          stable_id: string
          stall_number: string
          status: Database["public"]["Enums"]["stall_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          size?: string | null
          stable_id: string
          stall_number: string
          status?: Database["public"]["Enums"]["stall_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          size?: string | null
          stable_id?: string
          stall_number?: string
          status?: Database["public"]["Enums"]["stall_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stalls_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          horse_max: number | null
          horse_min: number
          includes_payments: boolean
          key: Database["public"]["Enums"]["stable_plan"]
          name: string
          price_nok: number
          sort_order: number
          updated_at: string
          visible: boolean
        }
        Insert: {
          horse_max?: number | null
          horse_min: number
          includes_payments?: boolean
          key: Database["public"]["Enums"]["stable_plan"]
          name: string
          price_nok: number
          sort_order: number
          updated_at?: string
          visible?: boolean
        }
        Update: {
          horse_max?: number | null
          horse_min?: number
          includes_payments?: boolean
          key?: Database["public"]["Enums"]["stable_plan"]
          name?: string
          price_nok?: number
          sort_order?: number
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed: boolean
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          horse_id: string | null
          id: string
          next_task_created_at: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          repeat_interval: string
          stable_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          horse_id?: string | null
          id?: string
          next_task_created_at?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          repeat_interval?: string
          stable_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          horse_id?: string | null
          id?: string
          next_task_created_at?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          repeat_interval?: string
          stable_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      turnout_shelters: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          size: string | null
          stable_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          size?: string | null
          stable_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          size?: string | null
          stable_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "turnout_shelters_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      vaccinations: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          dose: string
          horse_id: string
          id: string
          notes: string | null
          stable_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          dose: string
          horse_id: string
          id?: string
          notes?: string | null
          stable_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          dose?: string
          horse_id?: string
          id?: string
          notes?: string | null
          stable_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vaccinations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccinations_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccinations_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      dashboard_stats: {
        Row: {
          available_stalls: number | null
          occupied_stalls: number | null
          overdue_payments: number | null
          today_tasks: number | null
          total_horses: number | null
          upcoming_farrier_visits: number | null
          upcoming_payments: number | null
          upcoming_vet_visits: number | null
        }
        Relationships: []
      }
      overdue_payments_list: {
        Row: {
          amount: number | null
          contract_id: string | null
          created_at: string | null
          due_date: string | null
          horse_name: string | null
          id: string | null
          invoice_number: string | null
          notes: string | null
          owner_id: string | null
          owner_name: string | null
          paid_date: string | null
          payment_method: string | null
          stable_id: string | null
          status: Database["public"]["Enums"]["payment_status"] | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_summary: {
        Row: {
          paid_this_month: number | null
          total_due: number | null
          total_overdue: number | null
        }
        Relationships: []
      }
      recent_activity: {
        Row: {
          activity_type: string | null
          created_at: string | null
          id: string | null
          summary: string | null
        }
        Relationships: []
      }
      today_tasks_list: {
        Row: {
          assigned_to: string | null
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          horse_id: string | null
          horse_name: string | null
          id: string | null
          priority: Database["public"]["Enums"]["task_priority"] | null
          stable_id: string | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      upcoming_farrier_visits_list: {
        Row: {
          created_at: string | null
          description: string | null
          end_time: string | null
          event_type: Database["public"]["Enums"]["calendar_event_type"] | null
          horse_id: string | null
          horse_name: string | null
          id: string | null
          owner_id: string | null
          stable_id: string | null
          start_time: string | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      upcoming_payments_list: {
        Row: {
          amount: number | null
          contract_id: string | null
          created_at: string | null
          due_date: string | null
          horse_name: string | null
          id: string | null
          invoice_number: string | null
          notes: string | null
          owner_id: string | null
          owner_name: string | null
          paid_date: string | null
          payment_method: string | null
          stable_id: string | null
          status: Database["public"]["Enums"]["payment_status"] | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
      upcoming_vet_visits_list: {
        Row: {
          created_at: string | null
          description: string | null
          end_time: string | null
          event_type: Database["public"]["Enums"]["calendar_event_type"] | null
          horse_id: string | null
          horse_name: string | null
          id: string | null
          owner_id: string | null
          stable_id: string | null
          start_time: string | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_horse_id_fkey"
            columns: ["horse_id"]
            isOneToOne: false
            referencedRelation: "horses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_stable_id_fkey"
            columns: ["stable_id"]
            isOneToOne: false
            referencedRelation: "stables"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      publish_feeding_rota: {
        Args: {
          p_date_from: string
          p_date_to: string
          p_excluded_owner_ids: string[]
          p_notice_message: string
          p_notice_title: string
          p_plans: Json
        }
        Returns: number
      }
      remove_feeding_rota: {
        Args: {
          p_date_from: string
          p_date_to: string
          p_notice_message: string
          p_notice_title: string
        }
        Returns: number
      }
      set_card_agreement_paused: {
        Args: { p_contract_id: string; p_paused: boolean }
        Returns: undefined
      }
      can_pay_invoices_online: { Args: never; Returns: boolean }
      get_billing_rules: {
        Args: never
        Returns: { addon_enabled: boolean; charge_day: number }[]
      }
      queue_invoice_extra: {
        Args: {
          p_contract_id: string
          p_description: string
          p_price_list_item_id: string
          p_purchased_on: string
          p_quantity: number
        }
        Returns: { amount: number; bills_on: string; id: string }[]
      }
      remove_invoice_extra: { Args: { p_id: string }; Returns: undefined }
      set_charge_day: { Args: { p_charge_day: number }; Returns: undefined }
      accept_stable_invite: { Args: { p_token: string }; Returns: undefined }
      assign_staff_role: {
        Args: {
          p_role: Database["public"]["Enums"]["user_role"]
          p_user_id: string
        }
        Returns: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          stable_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      auth_owns_horse: { Args: { p_horse_id: string }; Returns: boolean }
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      auth_stable_id: { Args: never; Returns: string }
      book_dropin_session: {
        Args: {
          p_horse_id?: string
          p_owner_id: string
          p_rider_id?: string
          p_session_id: string
        }
        Returns: {
          cancelled_at: string | null
          created_at: string
          enrolment_id: string | null
          horse_id: string | null
          id: string
          owner_id: string
          rider_id: string | null
          session_id: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "lesson_bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_assign_horse_to_booking: {
        Args: { p_horse_id: string; p_owner_id: string }
        Returns: boolean
      }
      create_stable: {
        Args: {
          p_address?: string
          p_city?: string
          p_email?: string
          p_name: string
          p_phone?: string
          p_postal_code?: string
          p_stable_type?: string
        }
        Returns: {
          address: string | null
          bank_account_number: string | null
          business_register_registered: boolean
          city: string | null
          created_at: string
          default_contract_terms: string | null
          email: string | null
          enabled_features: Json
          id: string
          invoice_footer_text: string | null
          logo_url: string | null
          name: string
          org_number: string | null
          owner_user_id: string
          payment_terms_days: number
          phone: string | null
          plan: Database["public"]["Enums"]["stable_plan"]
          postal_code: string | null
          stable_type: Database["public"]["Enums"]["stable_type"]
          stripe_customer_id: string | null
          updated_at: string
          vat_registered: boolean
        }
        SetofOptions: {
          from: "*"
          to: "stables"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      enrol_in_course: {
        Args: {
          p_course_id: string
          p_horse_id?: string
          p_owner_id: string
          p_rider_id?: string
        }
        Returns: {
          course_id: string
          enrolled_at: string
          id: string
          rider_id: string | null
          status: string
          withdrawn_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "enrolments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_course_sessions: {
        Args: { p_course_id: string; p_sessions: Json }
        Returns: {
          capacity: number
          course_id: string | null
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          instructor_name: string | null
          notes: string | null
          stable_id: string
          starts_at: string
          status: string
          title: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "lesson_sessions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      generate_monthly_invoices: { Args: never; Returns: undefined }
      horse_stable_id: { Args: { p_horse_id: string }; Returns: string }
      link_horse_owner_account: {
        Args: { p_inviter_id: string; p_owner_id: string; p_user_id: string }
        Returns: undefined
      }
      log_horse_extra: {
        Args: {
          p_date: string
          p_horse_id: string
          p_price_list_item_id: string
          p_quantity: number
        }
        Returns: {
          amount: number
          contract_id: string
          created_at: string
          due_date: string
          id: string
          invoice_number: string | null
          notes: string | null
          owner_id: string
          paid_date: string | null
          payment_method: string | null
          stable_id: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      refresh_overdue_payments: { Args: never; Returns: undefined }
      request_feeding_shift_swap: {
        Args: { p_shift_id: string; p_to_owner_id: string }
        Returns: {
          created_at: string
          id: string
          requested_by_owner_id: string
          requested_to_owner_id: string
          responded_at: string | null
          shift_id: string
          stable_id: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "feeding_shift_swap_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      respond_feeding_shift_swap: {
        Args: { p_accept: boolean; p_swap_id: string }
        Returns: {
          created_at: string
          id: string
          requested_by_owner_id: string
          requested_to_owner_id: string
          responded_at: string | null
          shift_id: string
          stable_id: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "feeding_shift_swap_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revoke_staff_access: { Args: { p_staff_id: string }; Returns: undefined }
      send_feeding_shift_reminders: { Args: never; Returns: undefined }
      set_staff_role: {
        Args: {
          p_role: Database["public"]["Enums"]["user_role"]
          p_staff_id: string
        }
        Returns: undefined
      }
      withdraw_from_course: {
        Args: { p_enrolment_id: string }
        Returns: undefined
      }
    }
    Enums: {
      calendar_event_type:
        | "vet"
        | "farrier"
        | "vaccination"
        | "worming"
        | "training"
        | "stable_event"
        | "arena_booking"
        | "therapist"
        | "other"
      co_rider_billing_frequency: "per_session" | "monthly"
      contract_status: "active" | "ending_soon" | "expired" | "cancelled"
      course_booking_mode: "term_only" | "dropin_only" | "mixed"
      course_status: "draft" | "active" | "completed" | "cancelled"
      document_type:
        | "passport"
        | "insurance"
        | "contract"
        | "veterinary_report"
        | "receipt"
        | "photo"
      notification_type:
        | "payment_due"
        | "vaccination_due"
        | "contract_ending"
        | "farrier_reminder"
        | "medication_reminder"
        | "feeding_shift_assigned"
        | "feeding_shift_changed"
        | "feeding_shift_swap_requested"
        | "feeding_shift_swap_accepted"
        | "feeding_shift_swap_declined"
        | "feeding_shift_reminder"
      payment_status: "paid" | "due" | "overdue"
      stable_plan:
        | "small"
        | "medium"
        | "large"
        | "xlarge"
        | "small_payments"
        | "medium_payments"
        | "large_payments"
        | "xlarge_payments"
      stable_type: "boarding" | "riding_school" | "sales" | "private"
      stall_status: "available" | "occupied" | "reserved" | "maintenance"
      task_priority: "low" | "medium" | "high"
      user_role:
        | "stable_owner"
        | "stable_employee"
        | "horse_owner"
        | "riding_instructor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      calendar_event_type: [
        "vet",
        "farrier",
        "vaccination",
        "worming",
        "training",
        "stable_event",
        "arena_booking",
        "therapist",
        "other",
      ],
      co_rider_billing_frequency: ["per_session", "monthly"],
      contract_status: ["active", "ending_soon", "expired", "cancelled"],
      course_booking_mode: ["term_only", "dropin_only", "mixed"],
      course_status: ["draft", "active", "completed", "cancelled"],
      document_type: [
        "passport",
        "insurance",
        "contract",
        "veterinary_report",
        "receipt",
        "photo",
      ],
      notification_type: [
        "payment_due",
        "vaccination_due",
        "contract_ending",
        "farrier_reminder",
        "medication_reminder",
        "feeding_shift_assigned",
        "feeding_shift_changed",
        "feeding_shift_swap_requested",
        "feeding_shift_swap_accepted",
        "feeding_shift_swap_declined",
        "feeding_shift_reminder",
      ],
      payment_status: ["paid", "due", "overdue"],
      stable_plan: [
        "small",
        "medium",
        "large",
        "xlarge",
        "small_payments",
        "medium_payments",
        "large_payments",
        "xlarge_payments",
      ],
      stable_type: ["boarding", "riding_school", "sales", "private"],
      stall_status: ["available", "occupied", "reserved", "maintenance"],
      task_priority: ["low", "medium", "high"],
      user_role: [
        "stable_owner",
        "stable_employee",
        "horse_owner",
        "riding_instructor",
      ],
    },
  },
} as const
