/**
 * Converte e redimensiona um arquivo de imagem local para Base64 leve (WebP/JPEG),
 * aplicando crop quadrado centralizado (1:1) com dimensões máximas otimizadas para perfil.
 * 
 * Processamento client-side com compressão otimizada antes da persistência no perfil.
 */
export function processImageFileToBase64(file: File, maxSize = 180): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Selecione um arquivo de imagem válido (PNG, JPG, WebP)."));
      return;
    }

    // Limite preventivo de tamanho de arquivo inicial (5MB) para evitar congelamento de memória
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error("A imagem deve ter no máximo 5MB."));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const width = img.width;
        const height = img.height;

        // Crop quadrado proporcional centralizado
        const minDimension = Math.min(width, height);
        const sourceX = (width - minDimension) / 2;
        const sourceY = (height - minDimension) / 2;

        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Não foi possível processar a imagem."));
          return;
        }

        // Renderiza com suavização de alta qualidade
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, sourceX, sourceY, minDimension, minDimension, 0, 0, maxSize, maxSize);

        // Gera Base64 em WebP (fallback para JPEG caso WebP não seja suportado)
        let base64 = canvas.toDataURL("image/webp", 0.86);
        if (!base64.startsWith("data:image/webp")) {
          base64 = canvas.toDataURL("image/jpeg", 0.86);
        }

        resolve(base64);
      };

      img.onerror = () => reject(new Error("Erro ao decodificar a imagem selecionada."));
      img.src = event.target?.result as string;
    };

    reader.onerror = () => reject(new Error("Erro ao ler o arquivo de imagem."));
    reader.readAsDataURL(file);
  });
}
