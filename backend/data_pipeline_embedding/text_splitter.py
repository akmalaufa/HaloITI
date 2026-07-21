import json
from docx import Document
from typing import List, Dict, Any

class HierarchicalTextSplitter:
    def __init__(self, max_chunk_length: int = 3000):
        """
        Inisialisasi pemotong teks berbasis struktur (Heading 1-4) dan Semantik.
        max_chunk_length: Batas karakter maksimal (Standar Industri RAG Modern).
        """
        self.max_chunk_length = max_chunk_length

    def _clean_heading(self, text: str) -> str:
        """
        Membersihkan teks heading dari noise seperti 'JUDUL :' atau 'SUMBER :' beserta variasi spasinya.
        """
        import re
        # Hapus kata JUDUL atau SUMBER (case insensitive) diikuti spasi bebas dan titik dua
        cleaned = re.sub(r'(?i)(JUDUL|SUMBER)\s*:\s*', '', text)
        return cleaned.strip()

    def parse_docx(self, file_path: str) -> List[Dict[str, Any]]:
        """
        Membaca file .docx dan memecahnya menjadi daftar chunk terstruktur.
        Mengembalikan List of Dictionaries.
        """
        doc = Document(file_path)
        chunks: List[Dict[str, Any]] = []
        
        # State Tracking: Mengingat posisi hierarki yang sedang aktif
        state = {
            "h1": "Dokumen Tidak Diketahui", # Default fallback
            "h2": "",
            "h3": "",
            "h4": ""
        }
        
        current_content = ""

        def save_chunk():
            nonlocal current_content
            if not current_content.strip():
                return
            
            # Kategori DARI H2 SAMPAI H4 SAJA (H1 sudah jadi dokumen_asal)
            active_category = [state["h2"], state["h3"], state["h4"]]
            # Buang yang kosong, lalu gabung dengan " - "
            kategori_str = " - ".join([h for h in active_category if h])
            if not kategori_str:
                kategori_str = "Umum"
            
            # Panggil fungsi pemotong Semantik
            self._process_and_append_chunk(
                chunks_list=chunks, 
                dokumen_asal=state["h1"], 
                kategori=kategori_str, 
                content=current_content
            )
            
            # Kosongkan keranjang
            current_content = ""

        for para in doc.paragraphs:
            raw_text = para.text.strip()
            style = para.style.name

            if not raw_text:
                continue

            # Abaikan Link_Sumber sesuai kesepakatan
            if style == 'Link_Sumber':
                continue

            # UPDATE STATE HIERARKI
            if style == 'Heading 1':
                save_chunk()
                state["h1"] = self._clean_heading(raw_text)
                state["h2"] = state["h3"] = state["h4"] = ""
                
            elif style == 'Heading 2':
                save_chunk()
                state["h2"] = self._clean_heading(raw_text)
                state["h3"] = state["h4"] = ""
                
            elif style == 'Heading 3':
                save_chunk()
                state["h3"] = self._clean_heading(raw_text)
                state["h4"] = ""
                
            elif style == 'Heading 4':
                save_chunk()
                state["h4"] = self._clean_heading(raw_text)

            # TANGKAP ISI TEKS
            elif style in ['Normal', 'List Paragraph']:
                if style == 'List Paragraph':
                    current_content += f"• {raw_text}\n"
                else:
                    current_content += f"{raw_text}\n"

        # Simpan teks sisa di akhir dokumen
        save_chunk()

        return chunks

    def _process_and_append_chunk(self, chunks_list: List[Dict[str, Any]], dokumen_asal: str, kategori: str, content: str) -> None:
        """
        Fungsi internal untuk membungkus chunk ke format JSON Pinecone.
        Menggunakan Pemotongan Semantik (berbasis Baris Baru / Enter) jika over-limit.
        """
        content = content.strip()
        
        if len(content) > self.max_chunk_length:
            # OPSI B: Pemotongan Semantik (Jangan belah kalimat di tengah jalan)
            lines = content.split('\n')
            current_part = ""
            part_idx = 1
            
            for line in lines:
                # Edge Case: Kalau ada 1 baris yang saking panjangnya melebihi limit sendirian
                if len(line) > self.max_chunk_length:
                    if current_part.strip():
                        chunks_list.append({
                            "metadata": {"dokumen_asal": dokumen_asal, "kategori": f"{kategori} (Part {part_idx})"},
                            "text": current_part.strip()
                        })
                        part_idx += 1
                        current_part = ""
                        
                    # Lapis Kedua (Rem Darurat Pintar): Potong berdasarkan spasi terdekat (Bukan membelah huruf)
                    remaining_line = line
                    while len(remaining_line) > self.max_chunk_length:
                        # Cari spasi terakhir sebelum menyentuh batas max_chunk_length
                        cut_index = remaining_line.rfind(' ', 0, self.max_chunk_length)
                        if cut_index == -1:
                            # Jika benar-benar tidak ada spasi sama sekali (misal link URL 3000 karakter), terpaksa potong buta
                            cut_index = self.max_chunk_length
                            
                        part_text = remaining_line[:cut_index]
                        chunks_list.append({
                            "metadata": {"dokumen_asal": dokumen_asal, "kategori": f"{kategori} (Part {part_idx})"},
                            "text": part_text.strip()
                        })
                        remaining_line = remaining_line[cut_index:].strip()
                        part_idx += 1
                        
                    if remaining_line:
                        chunks_list.append({
                            "metadata": {"dokumen_asal": dokumen_asal, "kategori": f"{kategori} (Part {part_idx})"},
                            "text": remaining_line.strip()
                        })
                        part_idx += 1
                    continue

                # Jika ditambah baris baru melebihi limit, bungkus Part saat ini!
                if len(current_part) + len(line) + 1 > self.max_chunk_length:
                    chunks_list.append({
                        "metadata": {"dokumen_asal": dokumen_asal, "kategori": f"{kategori} (Part {part_idx})"},
                        "text": current_part.strip()
                    })
                    # Mulai Part baru dengan baris ini
                    current_part = line + "\n"
                    part_idx += 1
                else:
                    current_part += line + "\n"
            
            # Simpan sisa Part terakhir jika ada
            if current_part.strip():
                chunks_list.append({
                    "metadata": {"dokumen_asal": dokumen_asal, "kategori": f"{kategori} (Part {part_idx})"},
                    "text": current_part.strip()
                })
        else:
            # Kalau di bawah limit (3000 karakter), aman sentosa 1 chunk!
            chunks_list.append({
                "metadata": {
                    "dokumen_asal": dokumen_asal,
                    "kategori": kategori
                },
                "text": content
            })

if __name__ == "__main__":
    import os
    
    test_file = "../Scrapling_data/data_unstructured/Data_Prodi_Teknik_Kimia.docx" 
    
    if not os.path.exists(test_file):
        print(f"File tidak ditemukan: {test_file}")
    else:
        # Default baru: 3000 Karakter (sekitar 750 Token)
        splitter = HierarchicalTextSplitter(max_chunk_length=3000)
        
        try:
            print("Mulai memotong dokumen secara Semantik (Max 3000 karakter)...")
            hasil_chunks = splitter.parse_docx(test_file)
            
            output_file = "dump_hasil_chunk.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(hasil_chunks, f, ensure_ascii=False, indent=4)
                
            print(f"SUKSES! Berhasil memotong jadi {len(hasil_chunks)} chunks.")
            print(f"Buka '{output_file}' untuk melihat hasilnya!")
            
        except Exception as e:
            print(f"ERROR: {e}")