import os
import logging
import google.generativeai as genai
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import List, Optional

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("automation.log"),
        logging.StreamHandler()
    ]
)

# Configuração da API do Google Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyCq2WUCRoMFNC7_qY0uU30lESqvgndCBCU")
genai.configure(api_key=GEMINI_API_KEY)

# Criar a aplicação FastAPI
app = FastAPI(
    title="MPM AutoIA API",
    description="API para automação de quiz web com inteligência artificial",
    version="1.0.0"
)

# Adicionar middleware CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modelos de dados
class QuizQuestion(BaseModel):
    question: str
    options: List[str]

class QuizAnswer(BaseModel):
    answer: str
    confidence: Optional[float] = None

# Rota principal
@app.get("/")
async def read_root():
    return {"message": "MPM AutoIA - API de Automação de Quiz Web"}

# Rota para obter resposta da IA para uma pergunta
@app.post("/api/answer", response_model=QuizAnswer)
async def get_answer(quiz_question: QuizQuestion):
    try:
        # Preparar o modelo Gemini
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        # Formatar as opções
        options_text = "\n".join([f"{chr(65+i)}. {option}" for i, option in enumerate(quiz_question.options)])
        
        # Criar o prompt
        prompt = f"""Pergunta: {quiz_question.question}\n\nOpções:\n{options_text}\n\nQual é a resposta correta? Responda apenas com a letra da opção (A, B, C, D, etc.) ou o texto exato da opção correta."""
        
        # Primeira consulta
        response = model.generate_content(prompt)
        answer = response.text.strip()
        logging.info(f"Resposta da IA: {answer}")
        
        # Verificar se a resposta é uma letra ou texto completo
        if len(answer) == 1 and answer.upper() in [chr(65+i) for i in range(len(quiz_question.options))]:
            # Se for uma letra, retornar o texto da opção correspondente
            index = ord(answer.upper()) - 65
            if 0 <= index < len(quiz_question.options):
                return QuizAnswer(answer=quiz_question.options[index], confidence=0.9)
        
        # Se não for uma letra ou for inválida, retornar a resposta como está
        return QuizAnswer(answer=answer, confidence=0.8)
        
    except Exception as e:
        logging.error(f"Erro ao consultar IA: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Tratamento de erros
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": f"Erro interno: {str(exc)}"},
    )

# Iniciar o servidor com uvicorn quando executado diretamente
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)