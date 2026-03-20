import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

interface ReceiptData {
  merchantName: string | null;
  date: string | null;
  total: number | null;
  items: { name: string; price: number }[];
  category: string | null;
  confidence: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageBase64 } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Initialize ZAI
    const zai = await ZAI.create();

    // Use VLM to analyze the receipt
    const response = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a receipt scanning assistant. Analyze the receipt image and extract the following information in JSON format:
{
  "merchantName": "name of the store/merchant",
  "date": "YYYY-MM-DD format date from receipt",
  "total": total_amount_as_number,
  "items": [{"name": "item name", "price": price_as_number}],
  "category": "suggested category (Food, Transport, Shopping, Housing, Health, Entertainment, Utilities, Education, or Other)",
  "confidence": 0.0_to_1.0_confidence_score
}

Important:
- Extract the EXACT total amount from the receipt
- Convert date to YYYY-MM-DD format
- If you can't find something, use null
- Be accurate with numbers - don't round unless necessary
- Suggest the most appropriate category based on the merchant type
- Only respond with valid JSON, no other text`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please analyze this receipt and extract the information. Return only valid JSON.'
            },
            {
              type: 'image_url',
              image_url: {
                url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      return NextResponse.json({ error: 'Failed to analyze receipt' }, { status: 500 });
    }

    // Parse the JSON response
    let receiptData: ReceiptData;
    try {
      // Remove any markdown code blocks if present
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      receiptData = JSON.parse(jsonStr);
    } catch {
      console.error('Failed to parse VLM response:', content);
      return NextResponse.json({ 
        error: 'Failed to parse receipt data',
        rawResponse: content 
      }, { status: 500 });
    }

    // Validate and clean the data
    const cleanedData: ReceiptData = {
      merchantName: receiptData.merchantName || null,
      date: receiptData.date || null,
      total: typeof receiptData.total === 'number' ? receiptData.total : null,
      items: Array.isArray(receiptData.items) ? receiptData.items : [],
      category: receiptData.category || null,
      confidence: typeof receiptData.confidence === 'number' ? receiptData.confidence : 0.5,
    };

    return NextResponse.json({
      success: true,
      data: cleanedData
    });

  } catch (error) {
    console.error('Receipt scan error:', error);
    return NextResponse.json({ 
      error: 'Failed to scan receipt',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
