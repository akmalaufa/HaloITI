import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full pt-12 pb-8 relative z-20 bg-background/50 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <div className="grid gap-12 md:grid-cols-2 mb-20">
          
          {/* Kolom Kiri: HaloITI Brand */}
          <div className="max-w-md">
            <h3 className="text-3xl font-extrabold tracking-tight mb-4 text-white">
              HALO<span className="text-brand">ITI.</span>
            </h3>
            <p className="text-white/60 leading-relaxed text-lg font-medium mb-6">
              Asisten AI cerdas untuk layanan informasi kampus Institut Teknologi Indonesia. Mari rencanakan masa depanmu bersama kami.
            </p>
          </div>

          {/* Kolom Kanan: Kontak Kami */}
          <div className="md:ml-auto max-w-sm w-full">
            <h4 className="text-2xl font-bold text-white mb-4">Kontak Kami</h4>
            <div className="w-full h-0.5 bg-brand mb-6" />
            
            <div className="flex flex-col gap-3 text-white/80 text-lg leading-relaxed mb-6">
              <p>
                Jl. Raya Puspiptek, Kelurahan Setu,<br />
                Kecamatan Setu,<br />
                Kota Tangerang Selatan 15314
              </p>
              <p className="font-semibold text-white">081360090013</p>
              <p className="font-semibold text-white">info@iti.ac.id</p>
            </div>
            
            <div className="w-full h-0.5 bg-brand mb-8" />
            
            {/* Link Website Resmi */}
            <Link 
              href="https://iti.ac.id" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex text-base font-bold text-brand hover:text-brand/80 transition-colors underline underline-offset-4 decoration-brand/50 hover:decoration-brand"
            >
              Kunjungi Website ITI &rarr;
            </Link>
          </div>
        </div>

        {/* Bawah: Copyright */}
        <div className="border-t border-white/10 pt-8 text-center text-white/50 text-sm md:text-base font-medium">
          <p>
            Copyright &copy; 2026 Institut Teknologi Indonesia
          </p>
        </div>
      </div>
    </footer>
  );
}
