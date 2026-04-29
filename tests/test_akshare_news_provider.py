# -*- coding: utf-8 -*-
"""Unit tests for AkShareNewsProvider and A-share news routing."""

import sys
import unittest
from datetime import datetime
from types import ModuleType, SimpleNamespace
from unittest.mock import MagicMock, patch

# Mock newspaper before search_service import (optional dependency)
if "newspaper" not in sys.modules:
    mock_np = MagicMock()
    mock_np.Article = MagicMock()
    mock_np.Config = MagicMock()
    sys.modules["newspaper"] = mock_np


def _install_fake_akshare(stock_news_em_return):
    """Install a fake ``akshare`` module with a stub ``stock_news_em``."""
    fake = ModuleType("akshare")
    fake.stock_news_em = MagicMock(return_value=stock_news_em_return)
    sys.modules["akshare"] = fake
    return fake


def _make_news_df(rows):
    """Return a pandas DataFrame mimicking ``ak.stock_news_em`` output."""
    import pandas as pd

    columns = ["关键词", "新闻标题", "新闻内容", "发布时间", "文章来源", "新闻链接"]
    return pd.DataFrame(rows, columns=columns)


class AkShareNewsProviderTestCase(unittest.TestCase):
    def setUp(self) -> None:
        # Make sure prior fake akshare modules don't leak across tests.
        sys.modules.pop("akshare", None)

    def tearDown(self) -> None:
        sys.modules.pop("akshare", None)

    def test_applicable_only_to_a_share(self) -> None:
        from src.search_service import AkShareNewsProvider

        p = AkShareNewsProvider(enabled=True)
        # .SH / .SZ suffix → A 股
        self.assertTrue(p.applicable_to_stock("300769.SZ"))
        self.assertTrue(p.applicable_to_stock("600519.SH"))
        self.assertTrue(p.applicable_to_stock("000001.SZ"))
        # 无后缀 6 位数字兜底
        self.assertTrue(p.applicable_to_stock("600519"))
        self.assertTrue(p.applicable_to_stock("000001"))
        # 港股 / 美股 / 其他 → 不适用
        self.assertFalse(p.applicable_to_stock("AAPL"))
        self.assertFalse(p.applicable_to_stock("00700.HK"))
        self.assertFalse(p.applicable_to_stock("hk00700"))
        self.assertFalse(p.applicable_to_stock("00700"))
        self.assertFalse(p.applicable_to_stock(""))

    def test_search_maps_stock_news_em_rows(self) -> None:
        from src.search_service import AkShareNewsProvider

        rows = [
            (
                "600519",
                "贵州茅台一季度业绩公告",
                "2026 年一季度营收 539.09 亿元，同比 +6.54%。",
                "2026-04-25 10:15:22",
                "财联社",
                "https://example.com/news/1",
            ),
            (
                "600519",
                "茅台计划召开业绩说明会",
                "公司将于 5 月 11 日召开 2025 年度业绩说明会。",
                "2026-04-28 17:10:37",
                "界面新闻",
                "https://example.com/news/2",
            ),
        ]
        _install_fake_akshare(_make_news_df(rows))

        provider = AkShareNewsProvider(enabled=True)
        resp = provider.search("贵州茅台 600519", max_results=5, stock_code="600519")

        self.assertTrue(resp.success)
        self.assertEqual(len(resp.results), 2)
        self.assertEqual(resp.results[0].title, "贵州茅台一季度业绩公告")
        self.assertEqual(resp.results[0].source, "财联社")
        self.assertEqual(resp.results[0].published_date, "2026-04-25")
        self.assertEqual(resp.results[1].url, "https://example.com/news/2")

    def test_search_extracts_code_from_query_when_kwarg_missing(self) -> None:
        from src.search_service import AkShareNewsProvider

        rows = [
            (
                "600519",
                "Title",
                "Content",
                "2026-04-25 10:15:22",
                "Source",
                "https://example.com/x",
            )
        ]
        fake = _install_fake_akshare(_make_news_df(rows))

        provider = AkShareNewsProvider(enabled=True)
        resp = provider.search("贵州茅台 600519 最新消息", max_results=3)

        self.assertTrue(resp.success)
        self.assertEqual(len(resp.results), 1)
        fake.stock_news_em.assert_called_once_with(symbol="600519")

    def test_search_returns_failure_for_non_a_share_code(self) -> None:
        from src.search_service import AkShareNewsProvider

        _install_fake_akshare(_make_news_df([]))
        provider = AkShareNewsProvider(enabled=True)
        resp = provider.search("Apple AAPL latest news", max_results=3, stock_code="AAPL")

        self.assertFalse(resp.success)
        self.assertIn("A 股", resp.error_message)

    def test_search_handles_akshare_exception(self) -> None:
        from src.search_service import AkShareNewsProvider

        fake = ModuleType("akshare")
        fake.stock_news_em = MagicMock(side_effect=RuntimeError("boom"))
        sys.modules["akshare"] = fake

        provider = AkShareNewsProvider(enabled=True)
        resp = provider.search("贵州茅台 600519", max_results=3, stock_code="600519")

        self.assertFalse(resp.success)
        self.assertIn("AkShare 调用失败", resp.error_message or "")

    def test_disabled_provider_is_unavailable(self) -> None:
        from src.search_service import AkShareNewsProvider

        _install_fake_akshare(_make_news_df([]))
        provider = AkShareNewsProvider(enabled=False)
        self.assertFalse(provider.is_available)


class AShareRoutingTestCase(unittest.TestCase):
    """Verify that ``search_stock_news`` prefers AkShare for A-share symbols."""

    def setUp(self) -> None:
        sys.modules.pop("akshare", None)

    def tearDown(self) -> None:
        sys.modules.pop("akshare", None)

    def _service(self):
        from src.search_service import SearchService

        return SearchService(
            bocha_keys=["dummy_key"],
            searxng_public_instances_enabled=False,
            news_max_age_days=3,
            news_strategy_profile="short",
            news_akshare_enabled=True,
        )

    def test_a_share_query_uses_akshare_first(self) -> None:
        now_str = datetime.now().strftime("%Y-%m-%d 10:00:00")
        rows = [
            (
                "600519",
                f"贵州茅台一季报 #{i}",
                "净利润 272 亿元",
                now_str,
                "财联社",
                f"https://example.com/news/{i}",
            )
            for i in range(1, 4)
        ]
        _install_fake_akshare(_make_news_df(rows))
        service = self._service()

        # Bocha mock should NOT be called when AkShare succeeds first.
        bocha_search = MagicMock()
        for provider in service._providers:
            if provider.name == "Bocha":
                provider.search = bocha_search

        resp = service.search_stock_news("600519", "贵州茅台", max_results=3)

        self.assertTrue(resp.success)
        self.assertGreaterEqual(len(resp.results), 1)
        self.assertEqual(resp.results[0].source, "财联社")
        bocha_search.assert_not_called()

    def test_non_a_share_skips_akshare(self) -> None:
        from src.search_service import SearchResponse, SearchResult

        # Even if akshare module is available, a US ticker should bypass it.
        _install_fake_akshare(_make_news_df([]))
        service = self._service()

        bocha_search = MagicMock(
            return_value=SearchResponse(
                query="q",
                results=[
                    SearchResult(
                        title="Apple AAPL latest",
                        snippet="AAPL coverage",
                        url="https://example.com/aapl",
                        source="bocha.cn",
                        published_date=datetime.now().date().isoformat(),
                    )
                ],
                provider="Bocha",
                success=True,
            )
        )
        for provider in service._providers:
            if provider.name == "Bocha":
                provider.search = bocha_search

        resp = service.search_stock_news("AAPL", "Apple", max_results=3)

        self.assertTrue(resp.success)
        bocha_search.assert_called_once()
        # The fake akshare's stock_news_em must not have been invoked.
        self.assertEqual(sys.modules["akshare"].stock_news_em.call_count, 0)


if __name__ == "__main__":
    unittest.main()
