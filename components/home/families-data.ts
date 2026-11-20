/**
 * Scent families for the home page. Products are not tagged by family yet, so each
 * family finds its bottles by searching names and descriptions for its key notes.
 */
export interface ScentFamily {
  name: string;
  mood: string;
  keyword: string;
  notes: string[];
  description: string;
  swatch: string;
  panel: string;
  card: string;
  ink: 'light' | 'dark';
}

export const SCENT_FAMILIES: ScentFamily[] = [
  { name: 'Woody', mood: 'Woody and dry', keyword: 'wood', notes: ['Cedar', 'Sandalwood', 'Vetiver', 'Patchouli'], description: 'Dry, smooth and grounding. Cedar, sandalwood and vetiver that wear close and last.', swatch: '#8A6A4A', panel: '#DCCAB4', card: '#EDE3D6', ink: 'dark' },
  { name: 'Oud', mood: 'Smoky and deep', keyword: 'oud', notes: ['Oud', 'Incense', 'Saffron', 'Leather'], description: 'Rich, smoky and resinous. The deep heart of Arabian perfumery, made for evenings out.', swatch: '#3A2A20', panel: '#2A2019', card: '#3A2D24', ink: 'light' },
  { name: 'Floral', mood: 'Soft and floral', keyword: 'rose', notes: ['Rose', 'Jasmine', 'Peony', 'Tuberose'], description: 'Bright, romantic and easy to love. Rose, jasmine and peony from morning to night.', swatch: '#E7B8B0', panel: '#F0D5CF', card: '#F8E8E4', ink: 'dark' },
  { name: 'Gourmand', mood: 'Warm and sweet', keyword: 'vanilla', notes: ['Vanilla', 'Cacao', 'Caramel', 'Honey', 'Tonka', 'Amber'], description: 'Scents you could almost eat. Warm, sweet and cosy, best on cool evenings and close to the skin.', swatch: '#C08A4E', panel: '#EAD3B4', card: '#F6EBDD', ink: 'dark' },
  { name: 'Fresh', mood: 'Fresh and clean', keyword: 'citrus', notes: ['Bergamot', 'Lemon', 'Sea notes', 'Mint'], description: 'Light, clean and lifting. Citrus and airy notes for hot Accra afternoons.', swatch: '#D8D2A8', panel: '#E4E0C4', card: '#F1EFDF', ink: 'dark' },
  { name: 'Musk', mood: 'Soft and musky', keyword: 'musk', notes: ['White musk', 'Powder', 'Ambrette', 'Cashmere'], description: 'Soft, clean and skin-close. The scent of fresh laundry and warm skin.', swatch: '#EFE6DA', panel: '#EDE3D5', card: '#F7F1E9', ink: 'dark' },
];
