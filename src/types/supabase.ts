export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      announcements: {
        Row: {
          body: string;
          category: string;
          created_at: string;
          created_by: string;
          id: string;
          stable_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          body: string;
          category?: string;
          created_at?: string;
          created_by: string;
          id?: string;
          stable_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          category?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          stable_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "announcements_stable_id_fkey";
            columns: ["stable_id"];
            isOneToOne: false;
            referencedRelation: "stables";
            referencedColumns: ["id"];
          },
        ];
      };
      calendar_events: {
        Row: {
          created_at: string;
          description: string | null;
          end_time: string | null;
          event_type: Database["public"]["Enums"]["calendar_event_type"];
          horse_id: string | null;
          id: string;
          owner_id: string | null;
          stable_id: string;
          start_time: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          end_time?: string | null;
          event_type: Database["public"]["Enums"]["calendar_event_type"];
          horse_id?: string | null;
          id?: string;
          owner_id?: string | null;
          stable_id: string;
          start_time: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          end_time?: string | null;
          event_type?: Database["public"]["Enums"]["calendar_event_type"];
          horse_id?: string | null;
          id?: string;
          owner_id?: string | null;
          stable_id?: string;
          start_time?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "calendar_events_horse_id_fkey";
            columns: ["horse_id"];
            isOneToOne: false;
            referencedRelation: "horses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calendar_events_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "owners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calendar_events_stable_id_fkey";
            columns: ["stable_id"];
            isOneToOne: false;
            referencedRelation: "stables";
            referencedColumns: ["id"];
          },
        ];
      };
      contracts: {
        Row: {
          additional_services: string | null;
          bedding_price_list_item_id: string | null;
          bedding_quantity: number;
          boarding_price_list_item_id: string | null;
          created_at: string;
          deposit: number | null;
          end_date: string | null;
          hay_price_list_item_id: string | null;
          horse_id: string;
          id: string;
          included_hay_kg: number | null;
          included_services: string | null;
          monthly_rent: number;
          notes: string | null;
          owner_id: string;
          stable_id: string;
          stall_id: string | null;
          start_date: string;
          status: Database["public"]["Enums"]["contract_status"];
          updated_at: string;
        };
        Insert: {
          additional_services?: string | null;
          bedding_price_list_item_id?: string | null;
          bedding_quantity?: number;
          boarding_price_list_item_id?: string | null;
          created_at?: string;
          deposit?: number | null;
          end_date?: string | null;
          hay_price_list_item_id?: string | null;
          horse_id: string;
          id?: string;
          included_hay_kg?: number | null;
          included_services?: string | null;
          monthly_rent?: number;
          notes?: string | null;
          owner_id: string;
          stable_id: string;
          stall_id?: string | null;
          start_date: string;
          status?: Database["public"]["Enums"]["contract_status"];
          updated_at?: string;
        };
        Update: {
          additional_services?: string | null;
          bedding_price_list_item_id?: string | null;
          bedding_quantity?: number;
          boarding_price_list_item_id?: string | null;
          created_at?: string;
          deposit?: number | null;
          end_date?: string | null;
          hay_price_list_item_id?: string | null;
          horse_id?: string;
          id?: string;
          included_hay_kg?: number | null;
          included_services?: string | null;
          monthly_rent?: number;
          notes?: string | null;
          owner_id?: string;
          stable_id?: string;
          stall_id?: string | null;
          start_date?: string;
          status?: Database["public"]["Enums"]["contract_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contracts_bedding_price_list_item_id_fkey";
            columns: ["bedding_price_list_item_id"];
            isOneToOne: false;
            referencedRelation: "price_list_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_boarding_price_list_item_id_fkey";
            columns: ["boarding_price_list_item_id"];
            isOneToOne: false;
            referencedRelation: "price_list_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_hay_price_list_item_id_fkey";
            columns: ["hay_price_list_item_id"];
            isOneToOne: false;
            referencedRelation: "price_list_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_horse_id_fkey";
            columns: ["horse_id"];
            isOneToOne: false;
            referencedRelation: "horses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "owners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_stable_id_fkey";
            columns: ["stable_id"];
            isOneToOne: false;
            referencedRelation: "stables";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_stall_id_fkey";
            columns: ["stall_id"];
            isOneToOne: false;
            referencedRelation: "stalls";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          contract_id: string | null;
          created_at: string;
          document_type: Database["public"]["Enums"]["document_type"];
          file_url: string;
          horse_id: string | null;
          id: string;
          owner_id: string | null;
          stable_id: string;
          uploaded_at: string;
        };
        Insert: {
          contract_id?: string | null;
          created_at?: string;
          document_type: Database["public"]["Enums"]["document_type"];
          file_url: string;
          horse_id?: string | null;
          id?: string;
          owner_id?: string | null;
          stable_id: string;
          uploaded_at?: string;
        };
        Update: {
          contract_id?: string | null;
          created_at?: string;
          document_type?: Database["public"]["Enums"]["document_type"];
          file_url?: string;
          horse_id?: string | null;
          id?: string;
          owner_id?: string | null;
          stable_id?: string;
          uploaded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_contract_id_fkey";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_horse_id_fkey";
            columns: ["horse_id"];
            isOneToOne: false;
            referencedRelation: "horses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "owners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_stable_id_fkey";
            columns: ["stable_id"];
            isOneToOne: false;
            referencedRelation: "stables";
            referencedColumns: ["id"];
          },
        ];
      };
      feeding_plans: {
        Row: {
          created_at: string;
          evening_feed: string | null;
          evening_hay: string | null;
          evening_supplements: string | null;
          extras: string | null;
          horse_id: string;
          id: string;
          lunch: string | null;
          lunch_feed: string | null;
          lunch_hay: string | null;
          lunch_supplements: string | null;
          morning_feed: string | null;
          morning_hay: string | null;
          morning_supplements: string | null;
          special_instructions: string | null;
          stable_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          evening_feed?: string | null;
          evening_hay?: string | null;
          evening_supplements?: string | null;
          extras?: string | null;
          horse_id: string;
          id?: string;
          lunch?: string | null;
          lunch_feed?: string | null;
          lunch_hay?: string | null;
          lunch_supplements?: string | null;
          morning_feed?: string | null;
          morning_hay?: string | null;
          morning_supplements?: string | null;
          special_instructions?: string | null;
          stable_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          evening_feed?: string | null;
          evening_hay?: string | null;
          evening_supplements?: string | null;
          extras?: string | null;
          horse_id?: string;
          id?: string;
          lunch?: string | null;
          lunch_feed?: string | null;
          lunch_hay?: string | null;
          lunch_supplements?: string | null;
          morning_feed?: string | null;
          morning_hay?: string | null;
          morning_supplements?: string | null;
          special_instructions?: string | null;
          stable_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "feeding_plans_horse_id_fkey";
            columns: ["horse_id"];
            isOneToOne: true;
            referencedRelation: "horses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "feeding_plans_stable_id_fkey";
            columns: ["stable_id"];
            isOneToOne: false;
            referencedRelation: "stables";
            referencedColumns: ["id"];
          },
        ];
      };
      feeding_times: {
        Row: {
          created_at: string;
          feed: string | null;
          hay: string | null;
          horse_id: string;
          id: string;
          label: string;
          stable_id: string;
          supplements: string | null;
          time_of_day: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          feed?: string | null;
          hay?: string | null;
          horse_id: string;
          id?: string;
          label: string;
          stable_id: string;
          supplements?: string | null;
          time_of_day?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          feed?: string | null;
          hay?: string | null;
          horse_id?: string;
          id?: string;
          label?: string;
          stable_id?: string;
          supplements?: string | null;
          time_of_day?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "feeding_times_horse_id_fkey";
            columns: ["horse_id"];
            isOneToOne: false;
            referencedRelation: "horses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "feeding_times_stable_id_fkey";
            columns: ["stable_id"];
            isOneToOne: false;
            referencedRelation: "stables";
            referencedColumns: ["id"];
          },
        ];
      };
      horses: {
        Row: {
          active: boolean;
          age: number | null;
          allergies: string | null;
          arrival_date: string | null;
          away: boolean;
          back_hoof_size: string | null;
          birthday: string | null;
          breed: string | null;
          color: string | null;
          created_at: string;
          extras: string | null;
          feeding_notes: string | null;
          front_hoof_size: string | null;
          gender: string | null;
          id: string;
          insurance_company: string | null;
          insurance_number: string | null;
          medical_notes: string | null;
          microchip_number: string | null;
          name: string;
          notes: string | null;
          owner_id: string | null;
          passport_number: string | null;
          photo_url: string | null;
          stable_id: string;
          stall_id: string | null;
          status: string;
          updated_at: string;
          vaccination_status: string | null;
        };
        Insert: {
          active?: boolean;
          age?: number | null;
          allergies?: string | null;
          arrival_date?: string | null;
          away?: boolean;
          back_hoof_size?: string | null;
          birthday?: string | null;
          breed?: string | null;
          color?: string | null;
          created_at?: string;
          extras?: string | null;
          feeding_notes?: string | null;
          front_hoof_size?: string | null;
          gender?: string | null;
          id?: string;
          insurance_company?: string | null;
          insurance_number?: string | null;
          medical_notes?: string | null;
          microchip_number?: string | null;
          name: string;
          notes?: string | null;
          owner_id?: string | null;
          passport_number?: string | null;
          photo_url?: string | null;
          stable_id: string;
          stall_id?: string | null;
          status?: string;
          updated_at?: string;
          vaccination_status?: string | null;
        };
        Update: {
          active?: boolean;
          age?: number | null;
          allergies?: string | null;
          arrival_date?: string | null;
          away?: boolean;
          back_hoof_size?: string | null;
          birthday?: string | null;
          breed?: string | null;
          color?: string | null;
          created_at?: string;
          extras?: string | null;
          feeding_notes?: string | null;
          front_hoof_size?: string | null;
          gender?: string | null;
          id?: string;
          insurance_company?: string | null;
          insurance_number?: string | null;
          medical_notes?: string | null;
          microchip_number?: string | null;
          name?: string;
          notes?: string | null;
          owner_id?: string | null;
          passport_number?: string | null;
          photo_url?: string | null;
          stable_id?: string;
          stall_id?: string | null;
          status?: string;
          updated_at?: string;
          vaccination_status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "horses_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "owners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "horses_stable_id_fkey";
            columns: ["stable_id"];
            isOneToOne: false;
            referencedRelation: "stables";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "horses_stall_id_fkey";
            columns: ["stall_id"];
            isOneToOne: false;
            referencedRelation: "stalls";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_deliveries: {
        Row: {
          created_at: string;
          delivered_on: string;
          id: string;
          inventory_item_id: string;
          notes: string | null;
          quantity: number;
          stable_id: string;
        };
        Insert: {
          created_at?: string;
          delivered_on: string;
          id?: string;
          inventory_item_id: string;
          notes?: string | null;
          quantity: number;
          stable_id: string;
        };
        Update: {
          created_at?: string;
          delivered_on?: string;
          id?: string;
          inventory_item_id?: string;
          notes?: string | null;
          quantity?: number;
          stable_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_deliveries_inventory_item_id_fkey";
            columns: ["inventory_item_id"];
            isOneToOne: false;
            referencedRelation: "inventory_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_deliveries_stable_id_fkey";
            columns: ["stable_id"];
            isOneToOne: false;
            referencedRelation: "stables";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_items: {
        Row: {
          created_at: string;
          id: string;
          low_stock_days_threshold: number;
          notes: string | null;
          price_list_item_id: string;
          stable_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          low_stock_days_threshold?: number;
          notes?: string | null;
          price_list_item_id: string;
          stable_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          low_stock_days_threshold?: number;
          notes?: string | null;
          price_list_item_id?: string;
          stable_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_items_price_list_item_id_fkey";
            columns: ["price_list_item_id"];
            isOneToOne: false;
            referencedRelation: "price_list_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_items_stable_id_fkey";
            columns: ["stable_id"];
            isOneToOne: false;
            referencedRelation: "stables";
            referencedColumns: ["id"];
          },
        ];
      };
      medical_records: {
        Row: {
          created_at: string;
          date: string;
          description: string | null;
          document_url: string | null;
          horse_id: string;
          id: string;
          medication: string | null;
          next_due: string | null;
          stable_id: string;
          type: string | null;
          updated_at: string;
          veterinarian: string | null;
        };
        Insert: {
          created_at?: string;
          date?: string;
          description?: string | null;
          document_url?: string | null;
          horse_id: string;
          id?: string;
          medication?: string | null;
          next_due?: string | null;
          stable_id: string;
          type?: string | null;
          updated_at?: string;
          veterinarian?: string | null;
        };
        Update: {
          created_at?: string;
          date?: string;
          description?: string | null;
          document_url?: string | null;
          horse_id?: string;
          id?: string;
          medication?: string | null;
          next_due?: string | null;
          stable_id?: string;
          type?: string | null;
          updated_at?: string;
          veterinarian?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "medical_records_horse_id_fkey";
            columns: ["horse_id"];
            isOneToOne: false;
            referencedRelation: "horses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "medical_records_stable_id_fkey";
            columns: ["stable_id"];
            isOneToOne: false;
            referencedRelation: "stables";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          created_at: string;
          horse_id: string | null;
          id: string;
          is_read: boolean;
          message: string | null;
          notification_type: Database["public"]["Enums"]["notification_type"];
          owner_id: string | null;
          stable_id: string;
          title: string;
        };
        Insert: {
          created_at?: string;
          horse_id?: string | null;
          id?: string;
          is_read?: boolean;
          message?: string | null;
          notification_type: Database["public"]["Enums"]["notification_type"];
          owner_id?: string | null;
          stable_id: string;
          title: string;
        };
        Update: {
          created_at?: string;
          horse_id?: string | null;
          id?: string;
          is_read?: boolean;
          message?: string | null;
          notification_type?: Database["public"]["Enums"]["notification_type"];
          owner_id?: string | null;
          stable_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_horse_id_fkey";
            columns: ["horse_id"];
            isOneToOne: false;
            referencedRelation: "horses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "owners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_stable_id_fkey";
            columns: ["stable_id"];
            isOneToOne: false;
            referencedRelation: "stables";
            referencedColumns: ["id"];
          },
        ];
      };
      owners: {
        Row: {
          address: string | null;
          city: string | null;
          created_at: string;
          email: string | null;
          emergency_contact: string | null;
          emergency_phone: string | null;
          full_name: string;
          id: string;
          notes: string | null;
          payment_method: string | null;
          phone: string | null;
          postal_code: string | null;
          stable_id: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          address?: string | null;
          city?: string | null;
          created_at?: string;
          email?: string | null;
          emergency_contact?: string | null;
          emergency_phone?: string | null;
          full_name: string;
          id?: string;
          notes?: string | null;
          payment_method?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          stable_id: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          address?: string | null;
          city?: string | null;
          created_at?: string;
          email?: string | null;
          emergency_contact?: string | null;
          emergency_phone?: string | null;
          full_name?: string;
          id?: string;
          notes?: string | null;
          payment_method?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          stable_id?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "owners_stable_id_fkey";
            columns: ["stable_id"];
            isOneToOne: false;
            referencedRelation: "stables";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          contract_id: string;
          created_at: string;
          due_date: string;
          id: string;
          invoice_number: string | null;
          notes: string | null;
          owner_id: string;
          paid_date: string | null;
          payment_method: string | null;
          stable_id: string;
          status: Database["public"]["Enums"]["payment_status"];
          updated_at: string;
        };
        Insert: {
          amount: number;
          contract_id: string;
          created_at?: string;
          due_date: string;
          id?: string;
          invoice_number?: string | null;
          notes?: string | null;
          owner_id: string;
          paid_date?: string | null;
          payment_method?: string | null;
          stable_id: string;
          status?: Database["public"]["Enums"]["payment_status"];
          updated_at?: string;
        };
        Update: {
          amount?: number;
          contract_id?: string;
          created_at?: string;
          due_date?: string;
          id?: string;
          invoice_number?: string | null;
          notes?: string | null;
          owner_id?: string;
          paid_date?: string | null;
          payment_method?: string | null;
          stable_id?: string;
          status?: Database["public"]["Enums"]["payment_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_contract_id_fkey";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "owners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_stable_id_fkey";
            columns: ["stable_id"];
            isOneToOne: false;
            referencedRelation: "stables";
            referencedColumns: ["id"];
          },
        ];
      };
      price_list_items: {
        Row: {
          category: string | null;
          created_at: string;
          id: string;
          item: string;
          notes: string | null;
          price: number;
          stable_id: string;
          unit: string | null;
          updated_at: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          id?: string;
          item: string;
          notes?: string | null;
          price?: number;
          stable_id: string;
          unit?: string | null;
          updated_at?: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          id?: string;
          item?: string;
          notes?: string | null;
          price?: number;
          stable_id?: string;
          unit?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "price_list_items_stable_id_fkey";
            columns: ["stable_id"];
            isOneToOne: false;
            referencedRelation: "stables";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          phone: string | null;
          role: Database["public"]["Enums"]["user_role"];
          stable_id: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          stable_id?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          stable_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_stable_id_fkey";
            columns: ["stable_id"];
            isOneToOne: false;
            referencedRelation: "stables";
            referencedColumns: ["id"];
          },
        ];
      };
      stable_invites: {
        Row: {
          created_at: string;
          created_by: string;
          expires_at: string;
          id: string;
          kind: string;
          owner_id: string | null;
          role: Database["public"]["Enums"]["user_role"] | null;
          stable_id: string;
          token: string;
          used_at: string | null;
          used_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          expires_at?: string;
          id?: string;
          kind: string;
          owner_id?: string | null;
          role?: Database["public"]["Enums"]["user_role"] | null;
          stable_id: string;
          token?: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          id?: string;
          kind?: string;
          owner_id?: string | null;
          role?: Database["public"]["Enums"]["user_role"] | null;
          stable_id?: string;
          token?: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stable_invites_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stable_invites_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "owners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stable_invites_stable_id_fkey";
            columns: ["stable_id"];
            isOneToOne: false;
            referencedRelation: "stables";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stable_invites_used_by_fkey";
            columns: ["used_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      stables: {
        Row: {
          address: string | null;
          city: string | null;
          created_at: string;
          email: string | null;
          id: string;
          logo_url: string | null;
          name: string;
          owner_user_id: string;
          phone: string | null;
          postal_code: string | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          city?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          logo_url?: string | null;
          name: string;
          owner_user_id: string;
          phone?: string | null;
          postal_code?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          city?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          logo_url?: string | null;
          name?: string;
          owner_user_id?: string;
          phone?: string | null;
          postal_code?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      stalls: {
        Row: {
          created_at: string;
          id: string;
          notes: string | null;
          size: string | null;
          stable_id: string;
          stall_number: string;
          status: Database["public"]["Enums"]["stall_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          size?: string | null;
          stable_id: string;
          stall_number: string;
          status?: Database["public"]["Enums"]["stall_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          size?: string | null;
          stable_id?: string;
          stall_number?: string;
          status?: Database["public"]["Enums"]["stall_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stalls_stable_id_fkey";
            columns: ["stable_id"];
            isOneToOne: false;
            referencedRelation: "stables";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          assigned_to: string | null;
          completed: boolean;
          completed_at: string | null;
          created_at: string;
          description: string | null;
          due_date: string | null;
          horse_id: string | null;
          id: string;
          priority: Database["public"]["Enums"]["task_priority"];
          stable_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          description?: string | null;
          due_date?: string | null;
          horse_id?: string | null;
          id?: string;
          priority?: Database["public"]["Enums"]["task_priority"];
          stable_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          description?: string | null;
          due_date?: string | null;
          horse_id?: string | null;
          id?: string;
          priority?: Database["public"]["Enums"]["task_priority"];
          stable_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_horse_id_fkey";
            columns: ["horse_id"];
            isOneToOne: false;
            referencedRelation: "horses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_stable_id_fkey";
            columns: ["stable_id"];
            isOneToOne: false;
            referencedRelation: "stables";
            referencedColumns: ["id"];
          },
        ];
      };
      vaccinations: {
        Row: {
          created_at: string;
          created_by: string | null;
          date: string;
          dose: string;
          horse_id: string;
          id: string;
          notes: string | null;
          stable_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          date: string;
          dose: string;
          horse_id: string;
          id?: string;
          notes?: string | null;
          stable_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          date?: string;
          dose?: string;
          horse_id?: string;
          id?: string;
          notes?: string | null;
          stable_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vaccinations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vaccinations_horse_id_fkey";
            columns: ["horse_id"];
            isOneToOne: false;
            referencedRelation: "horses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vaccinations_stable_id_fkey";
            columns: ["stable_id"];
            isOneToOne: false;
            referencedRelation: "stables";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      dashboard_stats: {
        Row: {
          available_stalls: number | null;
          occupied_stalls: number | null;
          overdue_payments: number | null;
          today_tasks: number | null;
          total_horses: number | null;
          upcoming_farrier_visits: number | null;
          upcoming_payments: number | null;
          upcoming_vet_visits: number | null;
        };
        Relationships: [];
      };
      overdue_payments_list: {
        Row: {
          amount: number | null;
          contract_id: string | null;
          created_at: string | null;
          due_date: string | null;
          horse_name: string | null;
          id: string | null;
          invoice_number: string | null;
          notes: string | null;
          owner_id: string | null;
          owner_name: string | null;
          paid_date: string | null;
          payment_method: string | null;
          stable_id: string | null;
          status: Database["public"]["Enums"]["payment_status"] | null;
          updated_at: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_contract_id_fkey";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "owners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_stable_id_fkey";
            columns: ["stable_id"];
            isOneToOne: false;
            referencedRelation: "stables";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_summary: {
        Row: {
          paid_this_month: number | null;
          total_due: number | null;
          total_overdue: number | null;
        };
        Relationships: [];
      };
      recent_activity: {
        Row: {
          activity_type: string | null;
          created_at: string | null;
          id: string | null;
          summary: string | null;
        };
        Relationships: [];
      };
      today_tasks_list: {
        Row: {
          assigned_to: string | null;
          completed: boolean | null;
          completed_at: string | null;
          created_at: string | null;
          description: string | null;
          due_date: string | null;
          horse_id: string | null;
          horse_name: string | null;
          id: string | null;
          priority: Database["public"]["Enums"]["task_priority"] | null;
          stable_id: string | null;
          title: string | null;
          updated_at: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_horse_id_fkey";
            columns: ["horse_id"];
            isOneToOne: false;
            referencedRelation: "horses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_stable_id_fkey";
            columns: ["stable_id"];
            isOneToOne: false;
            referencedRelation: "stables";
            referencedColumns: ["id"];
          },
        ];
      };
      upcoming_farrier_visits_list: {
        Row: {
          created_at: string | null;
          description: string | null;
          end_time: string | null;
          event_type: Database["public"]["Enums"]["calendar_event_type"] | null;
          horse_id: string | null;
          horse_name: string | null;
          id: string | null;
          owner_id: string | null;
          stable_id: string | null;
          start_time: string | null;
          title: string | null;
          updated_at: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "calendar_events_horse_id_fkey";
            columns: ["horse_id"];
            isOneToOne: false;
            referencedRelation: "horses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calendar_events_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "owners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calendar_events_stable_id_fkey";
            columns: ["stable_id"];
            isOneToOne: false;
            referencedRelation: "stables";
            referencedColumns: ["id"];
          },
        ];
      };
      upcoming_payments_list: {
        Row: {
          amount: number | null;
          contract_id: string | null;
          created_at: string | null;
          due_date: string | null;
          horse_name: string | null;
          id: string | null;
          invoice_number: string | null;
          notes: string | null;
          owner_id: string | null;
          owner_name: string | null;
          paid_date: string | null;
          payment_method: string | null;
          stable_id: string | null;
          status: Database["public"]["Enums"]["payment_status"] | null;
          updated_at: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_contract_id_fkey";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "owners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_stable_id_fkey";
            columns: ["stable_id"];
            isOneToOne: false;
            referencedRelation: "stables";
            referencedColumns: ["id"];
          },
        ];
      };
      upcoming_vet_visits_list: {
        Row: {
          created_at: string | null;
          description: string | null;
          end_time: string | null;
          event_type: Database["public"]["Enums"]["calendar_event_type"] | null;
          horse_id: string | null;
          horse_name: string | null;
          id: string | null;
          owner_id: string | null;
          stable_id: string | null;
          start_time: string | null;
          title: string | null;
          updated_at: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "calendar_events_horse_id_fkey";
            columns: ["horse_id"];
            isOneToOne: false;
            referencedRelation: "horses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calendar_events_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "owners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calendar_events_stable_id_fkey";
            columns: ["stable_id"];
            isOneToOne: false;
            referencedRelation: "stables";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      accept_stable_invite: { Args: { p_token: string }; Returns: undefined };
      assign_staff_role: {
        Args: {
          p_role: Database["public"]["Enums"]["user_role"];
          p_user_id: string;
        };
        Returns: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          phone: string | null;
          role: Database["public"]["Enums"]["user_role"];
          stable_id: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "profiles";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      auth_role: {
        Args: never;
        Returns: Database["public"]["Enums"]["user_role"];
      };
      auth_stable_id: { Args: never; Returns: string };
      create_stable: {
        Args: {
          p_address?: string;
          p_city?: string;
          p_email?: string;
          p_name: string;
          p_phone?: string;
          p_postal_code?: string;
        };
        Returns: {
          address: string | null;
          city: string | null;
          created_at: string;
          email: string | null;
          id: string;
          logo_url: string | null;
          name: string;
          owner_user_id: string;
          phone: string | null;
          postal_code: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "stables";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      generate_monthly_invoices: { Args: never; Returns: undefined };
      link_horse_owner_account: {
        Args: { p_inviter_id: string; p_owner_id: string; p_user_id: string };
        Returns: undefined;
      };
      log_horse_extra: {
        Args: {
          p_date: string;
          p_horse_id: string;
          p_price_list_item_id: string;
          p_quantity: number;
        };
        Returns: {
          amount: number;
          contract_id: string;
          created_at: string;
          due_date: string;
          id: string;
          invoice_number: string | null;
          notes: string | null;
          owner_id: string;
          paid_date: string | null;
          payment_method: string | null;
          stable_id: string;
          status: Database["public"]["Enums"]["payment_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "payments";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      refresh_overdue_payments: { Args: never; Returns: undefined };
    };
    Enums: {
      calendar_event_type:
        | "vet"
        | "farrier"
        | "vaccination"
        | "worming"
        | "training"
        | "stable_event"
        | "arena_booking";
      contract_status: "active" | "ending_soon" | "expired" | "cancelled";
      document_type:
        | "passport"
        | "insurance"
        | "contract"
        | "veterinary_report"
        | "receipt"
        | "photo";
      notification_type:
        | "payment_due"
        | "vaccination_due"
        | "contract_ending"
        | "farrier_reminder"
        | "medication_reminder";
      payment_status: "paid" | "due" | "overdue";
      stall_status: "available" | "occupied" | "reserved" | "maintenance";
      task_priority: "low" | "medium" | "high";
      user_role: "stable_owner" | "stable_employee" | "horse_owner";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

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
      ],
      contract_status: ["active", "ending_soon", "expired", "cancelled"],
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
      ],
      payment_status: ["paid", "due", "overdue"],
      stall_status: ["available", "occupied", "reserved", "maintenance"],
      task_priority: ["low", "medium", "high"],
      user_role: ["stable_owner", "stable_employee", "horse_owner"],
    },
  },
} as const;
