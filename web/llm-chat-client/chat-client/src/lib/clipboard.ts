export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.warn('Clipboard API failed, trying fallback', err);
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;

            // Ensure the textarea is not visible but part of the DOM
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            textArea.style.top = '0';
            document.body.appendChild(textArea);

            textArea.focus();
            textArea.select();

            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);

            if (successful) {
                return true;
            }
            throw new Error('Fallback copy failed');
        } catch (fallbackErr) {
            console.error('All copy methods failed', fallbackErr);
            return false;
        }
    }
}
