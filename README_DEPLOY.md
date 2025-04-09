# Instruções de Deploy - MPM AutoIA

## Pré-requisitos

- Python 3.7 ou superior
- Todas as dependências instaladas (incluindo uvicorn)

## Instalação das Dependências

Antes de iniciar o deploy, certifique-se de que todas as dependências estão instaladas:

```bash
pip install -r requirements.txt
```

O arquivo `requirements.txt` já inclui o uvicorn com suas dependências padrão (`uvicorn[standard]`).

## Opções de Deploy

### 1. Deploy Local para Desenvolvimento

Para iniciar o servidor localmente durante o desenvolvimento:

```bash
python app.py
```

Isto iniciará o servidor uvicorn em modo de recarga automática na porta 8000.

### 2. Deploy Manual com Uvicorn

Para um deploy mais controlado, você pode iniciar o uvicorn diretamente:

```bash
uvicorn app:app --host 0.0.0.0 --port 8000
```

Opções úteis:
- `--host 0.0.0.0`: Permite acesso de qualquer IP (use com cuidado)
- `--port 8000`: Define a porta do servidor
- `--workers 4`: Define o número de processos de trabalho (recomendado: 2x número de CPUs)

### 3. Deploy em Produção

Para ambientes de produção, recomenda-se usar o Gunicorn como gerenciador de processos junto com o uvicorn:

```bash
pip install gunicorn
gunicorn app:app -w 4 -k uvicorn.workers.UvicornWorker
```

## Variáveis de Ambiente

A aplicação suporta as seguintes variáveis de ambiente:

- `GEMINI_API_KEY`: Chave da API do Google Gemini (opcional, há uma chave padrão no código)

## Endpoints da API

A API disponibiliza os seguintes endpoints:

- `GET /`: Página inicial com informações básicas
- `POST /api/answer`: Endpoint para obter respostas para perguntas de quiz
  - Corpo da requisição: `{"question": "texto da pergunta", "options": ["opção 1", "opção 2", ...]}`
  - Resposta: `{"answer": "resposta selecionada", "confidence": valor_de_confiança}`

## Documentação da API

Após iniciar o servidor, acesse a documentação interativa da API em:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Solução de Problemas

1. **Erro de porta em uso**: Se a porta 8000 já estiver em uso, especifique uma porta diferente:
   ```bash
   uvicorn app:app --port 8001
   ```

2. **Problemas com a API do Gemini**: Verifique se a chave API está correta e se você não excedeu os limites de uso.

3. **Logs**: Consulte o arquivo `automation.log` para informações detalhadas sobre erros.