export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type TableDefinition<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: unknown[];
};

export type Database = {
  public: {
    Tables: {
      products: TableDefinition<
        {
          id: string;
          name: string;
          base_unit_label: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          name: string;
          base_unit_label?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        }
      >;
      product_aliases: TableDefinition<
        {
          id: string;
          product_id: string;
          alias: string;
          normalized_alias: string;
          created_at: string;
        },
        {
          id?: string;
          product_id: string;
          alias: string;
          normalized_alias: string;
          created_at?: string;
        }
      >;
      packaging_conversions: TableDefinition<
        {
          id: string;
          product_id: string;
          packaging_type: string;
          multiplier: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          product_id: string;
          packaging_type: string;
          multiplier: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        }
      >;
      packaging_aliases: TableDefinition<
        {
          id: string;
          conversion_id: string;
          alias: string;
          normalized_alias: string;
          created_at: string;
        },
        {
          id?: string;
          conversion_id: string;
          alias: string;
          normalized_alias: string;
          created_at?: string;
        }
      >;
      lots: TableDefinition<
        {
          id: string;
          product_id: string;
          expiration_date: string;
          lot_code: string | null;
          original_quantity: number;
          current_quantity: number;
          status: "OPEN" | "ZEROED" | "CLOSED";
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          product_id: string;
          expiration_date: string;
          lot_code?: string | null;
          original_quantity: number;
          current_quantity: number;
          status?: "OPEN" | "ZEROED" | "CLOSED";
          created_at?: string;
          updated_at?: string;
        }
      >;
      inventory_movements: TableDefinition<
        {
          id: string;
          type: "ENTRY" | "EXIT" | "ZERO" | "ADJUSTMENT";
          product_id: string;
          lot_id: string | null;
          quantity_delta: number;
          quantity_before: number | null;
          quantity_after: number | null;
          source_text: string | null;
          parsed_command: Json;
          metadata: Json;
          occurred_at: string;
          created_at: string;
        },
        {
          id?: string;
          type: "ENTRY" | "EXIT" | "ZERO" | "ADJUSTMENT";
          product_id: string;
          lot_id?: string | null;
          quantity_delta: number;
          quantity_before?: number | null;
          quantity_after?: number | null;
          source_text?: string | null;
          parsed_command?: Json;
          metadata?: Json;
          occurred_at?: string;
          created_at?: string;
        }
      >;
      vocabulary_terms: TableDefinition<
        {
          id: string;
          group_name: "ENTRY" | "EXIT" | "ZERO" | "EXPIRATION" | "PACKAGING";
          term: string;
          normalized_term: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          group_name: "ENTRY" | "EXIT" | "ZERO" | "EXPIRATION" | "PACKAGING";
          term: string;
          normalized_term: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      inventory_apply_lot_movement: {
        Args: {
          p_lot_id: string;
          p_type: "ENTRY" | "EXIT" | "ZERO" | "ADJUSTMENT";
          p_quantity_delta: number;
          p_source_text?: string | null;
          p_parsed_command?: Json;
          p_metadata?: Json;
        };
        Returns: string;
      };
    };
    Enums: {
      inventory_movement_type: "ENTRY" | "EXIT" | "ZERO" | "ADJUSTMENT";
      lot_status: "OPEN" | "ZEROED" | "CLOSED";
      vocabulary_group: "ENTRY" | "EXIT" | "ZERO" | "EXPIRATION" | "PACKAGING";
    };
    CompositeTypes: Record<string, never>;
  };
};
