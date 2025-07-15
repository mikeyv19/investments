'use client'

import { useState } from 'react'
import { Modal } from '@/app/components/ui/modal'

interface BulkImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (tickers: string[]) => void
}

export default function BulkImportModal({ isOpen, onClose, onImport }: BulkImportModalProps) {
  const [inputText, setInputText] = useState('')
  const [parsedTickers, setParsedTickers] = useState<string[]>([])
  const [importMethod, setImportMethod] = useState<'paste' | 'file'>('paste')

  const parseTickers = (text: string) => {
    // Split by common delimiters: comma, semicolon, newline, tab, space
    const tickers = text
      .split(/[,;\n\t\s]+/)
      .map(ticker => ticker.trim().toUpperCase())
      .filter(ticker => ticker.length > 0 && ticker.length <= 10) // Basic validation
      .filter((ticker, index, self) => self.indexOf(ticker) === index) // Remove duplicates
    
    setParsedTickers(tickers)
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setInputText(text)
    parseTickers(text)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setInputText(text)
      parseTickers(text)
    }
    reader.readAsText(file)
  }

  const handleImport = () => {
    if (parsedTickers.length > 0) {
      onImport(parsedTickers)
      // Reset state
      setInputText('')
      setParsedTickers([])
      onClose()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk Import Stocks"
      size="lg"
    >
      <div className="p-6 max-h-[70vh] overflow-y-auto">
        
        <div className="mb-4">
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => setImportMethod('paste')}
              className={`px-4 py-2 rounded transition-colors ${
                importMethod === 'paste'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Paste Text
            </button>
            <button
              onClick={() => setImportMethod('file')}
              className={`px-4 py-2 rounded transition-colors ${
                importMethod === 'file'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Upload File
            </button>
          </div>

          {importMethod === 'paste' ? (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Paste your tickers below (separated by commas, spaces, or new lines)
              </label>
              <textarea
                value={inputText}
                onChange={handleTextChange}
                placeholder="AAPL, MSFT, GOOGL&#10;or&#10;AAPL MSFT GOOGL&#10;or&#10;AAPL&#10;MSFT&#10;GOOGL"
                className="w-full h-40 p-3 bg-background border border-input rounded-md text-foreground"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Upload a CSV or text file with tickers
              </label>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="w-full p-3 bg-background border border-input rounded-md text-foreground file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              />
            </div>
          )}
        </div>

        {parsedTickers.length > 0 && (
          <div className="mb-4 p-4 bg-muted/50 rounded">
            <h3 className="text-sm font-medium mb-2">
              Found {parsedTickers.length} unique ticker{parsedTickers.length !== 1 ? 's' : ''}:
            </h3>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {parsedTickers.map(ticker => (
                <span
                  key={ticker}
                  className="px-2 py-1 bg-primary/10 text-primary rounded text-sm"
                >
                  {ticker}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={parsedTickers.length === 0}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Import {parsedTickers.length > 0 ? `${parsedTickers.length} Stocks` : ''}
          </button>
        </div>
      </div>
    </Modal>
  )
}