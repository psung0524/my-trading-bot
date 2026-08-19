"""Run externally (Task Scheduler, cron, or container scheduler). Never sleeps forever in Streamlit."""
import logging
from .alerts import AlertService, TelegramChannel, OfficialKakaoChannel
from .repository import Repository
from .data_provider import SampleProvider
from .monitor import position_events

def run_once():
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    provider=SampleProvider(); prices={x.code:x.price for x in provider.snapshots()}; service=AlertService(Repository(),[TelegramChannel(),OfficialKakaoChannel()])
    for row in Repository().watchlist():
        for event in position_events(row,prices.get(row[0],row[2])): service.dispatch(event)
if __name__=='__main__': run_once()
