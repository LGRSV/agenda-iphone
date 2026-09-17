#!/usr/bin/env python3
"""Testes do plugin analise-verificada. Rode: python3 tests/test_verif.py"""
import json
import os
import subprocess
import sys
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "scripts"))

import verif  # noqa: E402
from verif import ErroVerif, avaliar, para_decimal, fmt  # noqa: E402

VERIF = [sys.executable, str(RAIZ / "scripts" / "verif.py")]
HOOK_STOP = [sys.executable, str(RAIZ / "scripts" / "hook_stop.py")]
HOOK_CTX = [sys.executable, str(RAIZ / "scripts" / "hook_contexto.py")]


def D(x):
    return Decimal(str(x))


class TestAritmetica(unittest.TestCase):
    def test_decimal_exato(self):
        self.assertEqual(avaliar("0.1 + 0.2", {}), D("0.3"))

    def test_dinheiro_nao_perde_centavo(self):
        self.assertEqual(avaliar("1234.56 * 3", {}), D("3703.68"))

    def test_precedencia(self):
        self.assertEqual(avaliar("2 + 3 * 4 ** 2", {}), D(50))

    def test_rotulos(self):
        r = {"salario": D("7430.00"), "gasto": D("1707.40")}
        self.assertEqual(avaliar("salario - gasto", r), D("5722.60"))

    def test_rotulo_desconhecido(self):
        with self.assertRaises(ErroVerif) as c:
            avaliar("receita - custo", {"receita": D(10)})
        self.assertIn("custo", str(c.exception))

    def test_ptbr_completo(self):
        self.assertEqual(avaliar("1.234,56 + 1", {}), D("1235.56"))

    def test_ponto_milhar_ambiguo_e_recusado(self):
        with self.assertRaises(ErroVerif) as c:
            avaliar("1.234 + 1", {})
        self.assertIn("ambiguo", str(c.exception))

    def test_virgula_solta_recusada(self):
        with self.assertRaises(ErroVerif) as c:
            avaliar("12,5 + 1", {})
        self.assertIn("ponto", str(c.exception))

    def test_virgula_em_funcao_e_valida(self):
        self.assertEqual(avaliar("soma(1, 2, 3)", {}), D(6))

    def test_porcentagem(self):
        self.assertEqual(avaliar("200 * 10%", {}), D(20))
        self.assertEqual(avaliar("1 / 10%", {}), D(10))

    def test_modulo_bloqueado_com_dica(self):
        with self.assertRaises(ErroVerif) as c:
            avaliar("10 % x", {"x": D(3)})
        self.assertIn("resto", str(c.exception))

    def test_funcoes(self):
        self.assertEqual(avaliar("media(2, 4, 9)", {}), D(5))
        self.assertEqual(avaliar("mediana(5, 1, 3)", {}), D(3))
        self.assertEqual(avaliar("mediana(1, 2, 3, 4)", {}), D("2.5"))
        self.assertEqual(avaliar("minimo(3, 1)", {}), D(1))
        self.assertEqual(avaliar("maximo(3, 1)", {}), D(3))
        self.assertEqual(avaliar("arred(2.345, 2)", {}), D("2.35"))
        self.assertEqual(avaliar("arred(2.5, 0)", {}), D(3))  # HALF_UP, nao bankers
        self.assertEqual(avaliar("raiz(9)", {}), D(3))
        self.assertEqual(avaliar("resto(10, 3)", {}), D(1))
        self.assertEqual(avaliar("modulo(-4)", {}), D(4))

    def test_desvpad_amostral(self):
        v = avaliar("desvpad(2, 4, 4, 4, 5, 5, 7, 9)", {})
        self.assertEqual(v.quantize(D("0.0001")), D("2.1381"))

    def test_divisao_por_zero(self):
        with self.assertRaises(ErroVerif):
            avaliar("1/0", {})

    def test_codigo_arbitrario_bloqueado(self):
        for expr in ["__import__('os')", "(1).__class__", "open('x')", "[1,2][0]", "x if 1 else 2"]:
            with self.assertRaises(ErroVerif, msg=expr):
                avaliar(expr, {"x": D(1)})


class TestValores(unittest.TestCase):
    def test_para_decimal(self):
        casos = {
            "1.234,56": "1234.56", "1,234.56": "1234.56", "12,5": "12.5",
            "R$ 7.430,00": "7430", "0,4%": "0.004", "-50": "-50", "1234": "1234",
        }
        for entrada, esperado in casos.items():
            self.assertEqual(fmt(para_decimal(entrada)), esperado, entrada)

    def test_para_decimal_ambiguo(self):
        with self.assertRaises(ErroVerif):
            para_decimal("1.234")


class TestAuditoria(unittest.TestCase):
    def livro(self, entradas, contra=None):
        d = verif.novo_livro("teste")
        for rotulo, tipo, valor, extra in entradas:
            verif.add_entrada(d, rotulo=rotulo, tipo=tipo, valor=str(valor), **extra)
        d["contra"] = contra or []
        return d

    def test_numero_sem_lastro_e_pego(self):
        d = self.livro([("a", "fato", "100", {"fonte": "x"})])
        r = verif.auditar_texto("O total foi 100 e a media 47,5.", d)
        self.assertFalse(r["ok"])
        self.assertEqual([s["token"] for s in r["sem_lastro"]], ["47,5"])

    def test_numero_registrado_passa(self):
        d = self.livro([("a", "fato", "5722.60", {"fonte": "x"})])
        r = verif.auditar_texto("Sobrou R$ 5.722,60 no mes.", d)
        self.assertTrue(r["ok"], r["sem_lastro"])

    def test_arredondamento_do_rascunho_e_aceito(self):
        d = self.livro([("a", "calculo", "1234.5678", {"expressao": "1234.5678"})])
        r = verif.auditar_texto("Deu 1.234,57 ao todo.", d)
        self.assertTrue(r["ok"], r["sem_lastro"])

    def test_ignora_codigo_datas_horas_e_anos(self):
        d = self.livro([("a", "fato", "100", {"fonte": "x"})])
        texto = (
            "Veja `SELECT 987654` e o bloco:\n```\nvalor = 55555\n```\n"
            "Em 2026-09-17, as 14:30, referente a 15/08/2025, versao v1.2.3, "
            "issue #4321, ano 2024. O total e 100.\n"
            "1. primeiro item\n2. segundo item\n"
            "Fonte: https://exemplo.com/a/99999\n"
        )
        r = verif.auditar_texto(texto, d)
        self.assertTrue(r["ok"], [s["token"] for s in r["sem_lastro"]])

    def test_numeros_pequenos_de_prosa_nao_alarmam(self):
        d = self.livro([("a", "fato", "100", {"fonte": "x"})])
        r = verif.auditar_texto("Sao 3 categorias e 2 contas; total 100.", d)
        self.assertTrue(r["ok"], [s["token"] for s in r["sem_lastro"]])

    def test_ignorar_regex_extra(self):
        d = self.livro([("a", "fato", "100", {"fonte": "x"})])
        r = verif.auditar_texto("Pedido 88123 fechou em 100.", d, ignorar_regex=[r"Pedido \d+"])
        self.assertTrue(r["ok"], [s["token"] for s in r["sem_lastro"]])

    def test_sugere_valores_proximos(self):
        d = self.livro([("total", "fato", "5722.60", {"fonte": "x"})])
        r = verif.auditar_texto("Sobrou 5.727,60.", d)
        self.assertFalse(r["ok"])
        self.assertIn("total=5722.6", r["sem_lastro"][0]["proximos"][0])

    def test_premissa_usada_e_sinalizada(self):
        d = self.livro([("infl", "premissa", "0.004", {"justificativa": "IPCA ago"})])
        r = verif.auditar_texto("Usei 0,004 de inflacao.", d)
        self.assertEqual(r["premissas_no_texto"], ["infl"])

    def test_recalculo_detecta_valor_adulterado(self):
        d = self.livro([
            ("a", "fato", "100", {"fonte": "x"}),
            ("b", "calculo", "999", {"expressao": "a * 2"}),
        ])
        rec = verif.recalcular(d)
        self.assertFalse(rec["ok"])
        self.assertEqual(rec["divergencias"][0]["recalculado"], "200")

    def test_recalculo_ok_quando_integro(self):
        d = self.livro([
            ("a", "fato", "100", {"fonte": "x"}),
            ("b", "calculo", "200", {"expressao": "a * 2"}),
        ])
        self.assertTrue(verif.recalcular(d)["ok"])


class TestCLI(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name) / ".analise"
        self.env = {**os.environ, "ANALISE_DIR": str(self.dir)}

    def tearDown(self):
        self.tmp.cleanup()

    def run_verif(self, *args, **kw):
        return subprocess.run(
            VERIF + list(args), capture_output=True, text=True, env=self.env,
            cwd=self.tmp.name, **kw
        )

    def test_fluxo_completo(self):
        self.assertEqual(self.run_verif("abrir", "Setembro").returncode, 0)

        r = self.run_verif("fato", "--rotulo", "salario", "--valor", "7.430,00",
                           "--fonte", "extrato:88")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("7430", r.stdout)

        r = self.run_verif("calc", "soma(1240.50, 389.90, 77.00)", "--rotulo", "mercado")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("1707.4", r.stdout)

        r = self.run_verif("calc", "salario - mercado", "--rotulo", "sobra", "--casas", "2")
        self.assertIn("5722.6", r.stdout)

        # rascunho com numero inventado -> reprova
        r = self.run_verif("auditar", "Sobrou R$ 5.722,60, sendo R$ 999,99 de lazer.")
        self.assertEqual(r.returncode, 1)
        self.assertIn("999,99", r.stdout)

        # fechar deve recusar: auditoria falhou, sem contra-analise
        r = self.run_verif("fechar", "--falseador", "x")
        self.assertEqual(r.returncode, 1)
        self.assertIn("contra-analise", r.stderr)

        # rascunho limpo -> aprova
        r = self.run_verif("auditar", "Sobrou R$ 5.722,60 em setembro.")
        self.assertEqual(r.returncode, 0, r.stdout)

        r = self.run_verif("fechar", "--falseador", "y")
        self.assertEqual(r.returncode, 1)
        self.assertIn("contra-analise", r.stderr)

        self.assertEqual(self.run_verif(
            "contra", "--afirmacao", "sobrou dinheiro", "--teste", "somei programadas",
            "--resultado", "cai para 1110.60", "--veredito", "inconclusivo").returncode, 0)

        r = self.run_verif("fechar", "--falseador", "Se as parcelas forem antecipadas")
        self.assertEqual(r.returncode, 0, r.stderr)

        # depois de fechada nao ha analise aberta
        self.assertEqual(self.run_verif("status").returncode, 1)

    def test_rotulo_duplicado_recusado(self):
        self.run_verif("abrir", "T")
        self.run_verif("fato", "--rotulo", "a", "--valor", "1", "--fonte", "f")
        r = self.run_verif("fato", "--rotulo", "a", "--valor", "2", "--fonte", "f")
        self.assertEqual(r.returncode, 2)
        self.assertIn("ja usado", r.stderr)

    def test_rotulo_invalido_recusado(self):
        self.run_verif("abrir", "T")
        for mau in ["2a", "a-b", "soma"]:
            r = self.run_verif("fato", "--rotulo", mau, "--valor", "1", "--fonte", "f")
            self.assertEqual(r.returncode, 2, mau)

    def test_fato_exige_fonte(self):
        self.run_verif("abrir", "T")
        r = self.run_verif("fato", "--rotulo", "a", "--valor", "1", "--fonte", "  ")
        self.assertEqual(r.returncode, 2)
        self.assertIn("fonte", r.stderr)

    def test_sem_analise_aberta(self):
        r = self.run_verif("calc", "1+1", "--rotulo", "a")
        self.assertEqual(r.returncode, 2)
        self.assertIn("nenhuma analise aberta", r.stderr)

    def test_abrir_duas_vezes_exige_forcar(self):
        self.run_verif("abrir", "A")
        self.assertEqual(self.run_verif("abrir", "B").returncode, 2)
        self.assertEqual(self.run_verif("abrir", "B", "--forcar").returncode, 0)

    def test_relatorio_marca_origem(self):
        self.run_verif("abrir", "T")
        self.run_verif("fato", "--rotulo", "a", "--valor", "10", "--fonte", "planilha.csv:3")
        self.run_verif("calc", "a * 2", "--rotulo", "b")
        self.run_verif("premissa", "--rotulo", "c", "--valor", "5", "--justificativa", "chute")
        r = self.run_verif("relatorio")
        self.assertIn("VERIFICADO", r.stdout)
        self.assertIn("CALCULADO", r.stdout)
        self.assertIn("PREMISSA", r.stdout)
        self.assertIn("planilha.csv:3", r.stdout)

    def test_fechar_forcado_registra_pendencias(self):
        self.run_verif("abrir", "T")
        r = self.run_verif("fechar", "--falseador", "z", "--forcar")
        self.assertEqual(r.returncode, 0)
        dados = json.loads(next(self.dir.glob("*.json")).read_text())
        self.assertEqual(dados["status"], "fechada")
        self.assertTrue(dados["fechada_forcada"])


class TestHooks(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.cwd = Path(self.tmp.name)
        self.dir = self.cwd / ".analise"
        self.env = {k: v for k, v in os.environ.items() if k != "ANALISE_DIR"}

    def tearDown(self):
        self.tmp.cleanup()

    def verif(self, *args):
        return subprocess.run(VERIF + list(args), capture_output=True, text=True,
                              cwd=self.tmp.name, env=self.env)

    def stop(self, mensagem, agent_type=None):
        payload = {"hook_event_name": "Stop", "cwd": str(self.cwd),
                   "last_assistant_message": mensagem}
        if agent_type:
            payload["agent_type"] = agent_type
        return subprocess.run(HOOK_STOP, input=json.dumps(payload), capture_output=True,
                              text=True, env=self.env)

    def test_sem_analise_aberta_nao_interfere(self):
        r = self.stop("O total foi R$ 9.999,99.")
        self.assertEqual(r.returncode, 0)
        self.assertEqual(r.stdout.strip(), "")

    def test_bloqueia_numero_sem_lastro(self):
        self.verif("abrir", "T")
        self.verif("fato", "--rotulo", "a", "--valor", "100", "--fonte", "f")
        r = self.stop("O resultado foi R$ 4.312,88.")
        self.assertEqual(r.returncode, 2)
        self.assertIn("4.312,88", r.stderr)

    def test_bloqueia_por_falta_de_contra_analise(self):
        self.verif("abrir", "T")
        self.verif("fato", "--rotulo", "a", "--valor", "100", "--fonte", "f")
        r = self.stop("O resultado foi 100.")
        self.assertEqual(r.returncode, 2)
        self.assertIn("contra-analise", r.stderr)

    def test_libera_quando_tudo_registrado(self):
        self.verif("abrir", "T")
        self.verif("fato", "--rotulo", "a", "--valor", "100", "--fonte", "f")
        self.verif("contra", "--afirmacao", "x", "--teste", "y", "--resultado", "z",
                   "--veredito", "sustenta")
        r = self.stop("O resultado foi 100.")
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_resposta_sem_numero_passa(self):
        self.verif("abrir", "T")
        r = self.stop("Vou comecar analisando o extrato de setembro.")
        self.assertEqual(r.returncode, 0)

    def test_subagente_nao_e_bloqueado(self):
        self.verif("abrir", "T")
        r = self.stop("O resultado foi R$ 4.312,88.", agent_type="Explore")
        self.assertEqual(r.returncode, 0)

    def test_limite_de_bloqueios_evita_laco(self):
        self.verif("abrir", "T")
        for _ in range(verif.MAX_BLOQUEIOS):
            self.assertEqual(self.stop("Deu R$ 4.312,88.").returncode, 2)
        r = self.stop("Deu R$ 4.312,88.")
        self.assertEqual(r.returncode, 0)
        self.assertIn("limite de bloqueios", json.loads(r.stdout)["systemMessage"])

    def test_auditoria_limpa_zera_bloqueios(self):
        self.verif("abrir", "T")
        self.verif("fato", "--rotulo", "a", "--valor", "100", "--fonte", "f")
        self.stop("Deu R$ 4.312,88.")
        dados = json.loads(next(self.dir.glob("*.json")).read_text())
        self.assertEqual(dados["bloqueios"], 1)
        self.verif("auditar", "O total e 100.")
        dados = json.loads(next(self.dir.glob("*.json")).read_text())
        self.assertEqual(dados["bloqueios"], 0)

    def test_entrada_invalida_nao_derruba_hook(self):
        r = subprocess.run(HOOK_STOP, input="nao e json", capture_output=True, text=True)
        self.assertEqual(r.returncode, 0)

    def test_hook_contexto_reinjeta_livro(self):
        self.verif("abrir", "Setembro")
        self.verif("fato", "--rotulo", "salario", "--valor", "7430", "--fonte", "extrato:88")
        payload = {"hook_event_name": "PostCompact", "cwd": str(self.cwd), "trigger": "auto"}
        r = subprocess.run(HOOK_CTX, input=json.dumps(payload), capture_output=True,
                           text=True, env=self.env)
        self.assertEqual(r.returncode, 0)
        saida = json.loads(r.stdout)
        self.assertIn("salario", saida["additionalContext"])
        self.assertIn("7430", saida["additionalContext"])
        self.assertIn("extrato:88", saida["additionalContext"])

    def test_hook_contexto_silencioso_sem_analise(self):
        payload = {"hook_event_name": "SessionStart", "cwd": str(self.cwd)}
        r = subprocess.run(HOOK_CTX, input=json.dumps(payload), capture_output=True,
                           text=True, env=self.env)
        self.assertEqual(r.returncode, 0)
        self.assertEqual(r.stdout.strip(), "")



class TestRegressoes(unittest.TestCase):
    """Casos que ja quebraram uma vez."""

    def livro(self, entradas):
        d = verif.novo_livro("teste")
        for rotulo, tipo, valor, extra in entradas:
            verif.add_entrada(d, rotulo=rotulo, tipo=tipo, valor=str(valor), **extra)
        return d

    def test_ano_no_fim_da_frase_e_ignorado(self):
        d = self.livro([("a", "fato", "100", {"fonte": "x"})])
        r = verif.auditar_texto("Comparado a 2024. O total e 100.", d)
        self.assertTrue(r["ok"], [s["token"] for s in r["sem_lastro"]])

    def test_valor_em_reais_parecido_com_ano_nao_escapa(self):
        d = self.livro([("a", "fato", "100", {"fonte": "x"})])
        for texto in ["Gastei R$ 2024 no mes. Total 100.", "Gastei R$2024. Total 100."]:
            r = verif.auditar_texto(texto, d)
            self.assertFalse(r["ok"], texto)
            self.assertIn("2024", [s["token"] for s in r["sem_lastro"]])

    def test_ano_com_decimais_nao_e_tratado_como_ano(self):
        d = self.livro([("a", "fato", "100", {"fonte": "x"})])
        r = verif.auditar_texto("Deu 2024,50 no total.", d)
        self.assertFalse(r["ok"])
        self.assertIn("2024,50", [s["token"] for s in r["sem_lastro"]])

    def test_com_anos_ativado_o_ano_e_auditado(self):
        d = self.livro([("a", "fato", "100", {"fonte": "x"})])
        r = verif.auditar_texto("Em 2024 o total foi 100.", d, ignorar_anos=False)
        self.assertFalse(r["ok"])

    def test_relatorio_funciona_apos_fechar(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            env = {**os.environ, "ANALISE_DIR": str(Path(tmp) / ".analise")}
            def run(*a):
                return subprocess.run(VERIF + list(a), capture_output=True, text=True,
                                      env=env, cwd=tmp)
            run("abrir", "T")
            run("fato", "--rotulo", "a", "--valor", "10", "--fonte", "planilha:1")
            run("auditar", "O valor e 10.")
            run("contra", "--afirmacao", "x", "--teste", "y", "--resultado", "z",
                "--veredito", "refuta")
            self.assertEqual(run("fechar", "--falseador", "w").returncode, 0)
            r = run("relatorio")
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn("planilha:1", r.stdout)
            self.assertIn("O que mudaria esta conclusao", r.stdout)

    def test_percentual_valido_continua_passando(self):
        for expr, esperado in [("200 * 10%", "20"), ("soma(10%, 5)", "5.1"),
                               ("(10%)", "0.1"), ("1 - 5%", "0.95")]:
            self.assertEqual(fmt(avaliar(expr, {})), esperado, expr)

    def test_tentativa_de_modulo_da_mensagem_util(self):
        for expr in ["10 % 3", "10 % x", "10 %(2)"]:
            with self.assertRaises(ErroVerif, msg=expr) as c:
                avaliar(expr, {"x": D(3)})
            self.assertIn("resto(a, b)", str(c.exception), expr)

if __name__ == "__main__":
    unittest.main(verbosity=2)
